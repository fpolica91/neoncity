import { Engine } from "@babylonjs/core/Engines/engine";
import { createScene } from "./scene/index";
import { Connection } from "./connection";
import { store } from "./state/store";
import { MultiCity } from "./scene/multi-city";
import { MiniMap } from "./scene/mini-map";
import { createOverlay } from "./gui/overlay";
import { SessionPanel } from "./gui/session-panel";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import {
  generateMission,
  formatBriefing,
  createProgression,
  updateProgression,
  getLevelTitle,
  type ProgressionState,
  type Mission,
} from "../shared/storyline";
import { MissionPanel } from "./gui/mission-panel";
import { AudioManager } from "./audio/audio-manager";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new Engine(canvas, true, {
  stencil: true,
  antialias: true,
  preserveDrawingBuffer: true,
});

const scene = createScene(engine, canvas);

// Multi-city with districts + transit lines + agent avatars
const city = new MultiCity(scene);

// GUI overlay
const gui = createOverlay(scene);
const sessionPanel = new SessionPanel(gui);
const missionPanel = new MissionPanel(gui);

// Wire mission panel stats to the overlay stats block
const statsBlock = gui.getControlByName("stats-text") as import("@babylonjs/gui/2D").TextBlock;
if (statsBlock) missionPanel.setStatsBlock(statsBlock);

// Track active missions for completion
const activeMissions = new Map<string, Mission>();

// Progression state — persists across missions
let progression: ProgressionState = createProgression();

// Get camera for minimap
const camera = scene.activeCamera as import("@babylonjs/core/Cameras/arcRotateCamera").ArcRotateCamera;
const miniMap = new MiniMap(gui, camera, scene);

// Chat input wiring
const chatInput = gui.getControlByName("chat-input") as import("@babylonjs/gui/2D").InputText;
const sendBtn = gui.getControlByName("send-btn") as import("@babylonjs/gui/2D").Button;
const statusText = gui.getControlByName("status-text") as import("@babylonjs/gui/2D").TextBlock;

let selectedProjectPath = "/home/fabricio";

function sendPrompt(): void {
  if (!chatInput || !chatInput.text.trim()) return;
  connection.send({
    type: "prompt:send",
    payload: {
      projectPath: selectedProjectPath,
      prompt: chatInput.text.trim(),
    },
  });
  chatInput.text = "";
}

chatInput?.onKeyboardEventProcessedObservable.add((evt) => {
  if (evt.type === "keydown" && (evt as KeyboardEvent).key === "Enter") {
    sendPrompt();
  }
});
sendBtn?.onPointerUpObservable.add(() => sendPrompt());

// Click on buildings to inspect
scene.onPointerObservable.add((pointerInfo) => {
  if (pointerInfo.type === PointerEventTypes.POINTERTAP) {
    const pickResult = scene.pick(scene.pointerX, scene.pointerY);
    if (pickResult?.hit && pickResult.pickedMesh) {
      const mesh = pickResult.pickedMesh;
      let target = mesh;
      while (target.parent && !target.name.startsWith("live-") && !target.name.startsWith("building-") && !target.name.startsWith("agent-")) {
        target = target.parent as import("@babylonjs/core/Meshes/mesh").Mesh;
      }

      const name = target.name;
      if (name.startsWith("live-") || name.startsWith("building-")) {
        const projectId = name.replace("live-", "").replace("building-", "");
        const project = store.projects.get(projectId);
        if (project) {
          selectedProjectPath = project.path;
          const sessions = [...store.sessions.values()].filter(
            (s) => s.projectId === projectId
          );
          sessionPanel.show(project, sessions);
        }
      }
    }
  }
});

engine.runRenderLoop(() => {
  scene.render();
});

window.addEventListener("resize", () => {
  engine.resize();
});

// Audio — init on first user interaction (browser autoplay policy)
const audio = new AudioManager();
const initAudio = () => {
  audio.init();
  canvas.removeEventListener("pointerdown", initAudio);
  canvas.removeEventListener("keydown", initAudio);
};
canvas.addEventListener("pointerdown", initAudio);
canvas.addEventListener("keydown", initAudio);

// Connect to bridge server
const connection = new Connection();

function updateStatsDisplay(): void {
  if (statsBlock) {
    const levelTitle = getLevelTitle(progression.level);
    statsBlock.text = `LV${progression.level} ${levelTitle}  |  MISSIONS: ${progression.completedMissions}  |  CREDITS: ${progression.credits}`;
  }
}

connection.onEvent((event) => {
  store.handleEvent(event);

  // Update city from events
  if (event.type === "state:full_sync") {
    city.syncProjects(store.projects);
    miniMap.updateProjects(store.projects);
    if (statusText) statusText.text = "CONNECTED";
  } else if (event.type === "project:discovered") {
    city.syncProjects(store.projects);
    miniMap.updateProjects(store.projects);
  } else {
    city.handleEvent(event as { type: string; payload: Record<string, unknown> });

    // Storyline: generate mission briefings for tasks
    if (event.type === "task:created") {
      const p = event.payload as Record<string, string>;
      const mission = generateMission(
        p.taskId || "unknown",
        p.subject || "Mission",
        p.description,
        progression,
      );
      activeMissions.set(mission.id, mission);
      missionPanel.showMission(mission);
      updateStatsDisplay();
      console.log(`[NeonCity] ${formatBriefing(mission)}`);
    }

    if (event.type === "task:completed") {
      const p = event.payload as Record<string, string>;
      const taskId = p.taskId || "";
      const missionKey = `mission-${taskId}`;
      const mission = activeMissions.get(missionKey);
      if (mission) {
        mission.status = "completed";
        mission.objectives.forEach((o) => { o.completed = true; });
        progression = updateProgression(progression, mission, "completed");
        missionPanel.completeMission(mission);
        activeMissions.delete(missionKey);
        audio.playTaskComplete();
        updateStatsDisplay();
      }
    }

    if (event.type === "task:failed") {
      const p = event.payload as Record<string, string>;
      const taskId = p.taskId || "";
      const missionKey = `mission-${taskId}`;
      const mission = activeMissions.get(missionKey);
      if (mission) {
        mission.status = "failed";
        progression = updateProgression(progression, mission, "failed");
        missionPanel.failMission(mission);
        activeMissions.delete(missionKey);
        audio.playError();
        updateStatsDisplay();
      }
    }

    if (event.type === "session:tool_pre") {
      miniMap.updateProjects(store.projects);
      audio.playToolCall();
    }

    if (event.type === "agent:start") {
      audio.playAgentSpawn();
    }

    if (event.type === "session:tool_fail") {
      audio.playError();
    }
  }

  if (event.type !== "state:full_sync") {
    console.log(`[NeonCity] ${event.type}`, event.payload);
  }
});

connection.connect();
