import {
  TextBlock,
  Rectangle,
  StackPanel,
  Control,
} from "@babylonjs/gui/2D";
import type { Mission } from "../../shared/storyline";
import { FACTIONS } from "../../shared/storyline";

/**
 * In-world mission briefing panel that slides in when a new task arrives.
 * Shows the cyberpunk mission framing with objectives, intel, and faction info.
 */
export class MissionPanel {
  private panel: Rectangle;
  private container: StackPanel;
  private titleBlock: TextBlock;
  private briefingBlock: TextBlock;
  private objectivesBlock: TextBlock;
  private rewardBlock: TextBlock;
  private difficultyBlock: TextBlock;
  private factionBlock: TextBlock;
  private intelBlock: TextBlock;
  private chainBlock: TextBlock;
  private gui: import("@babylonjs/gui/2D").AdvancedDynamicTexture;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private completedMissions = 0;
  private totalCredits = 0;

  // Stats display references
  private statsBlock: TextBlock | null = null;

  constructor(gui: import("@babylonjs/gui/2D").AdvancedDynamicTexture) {
    this.gui = gui;

    this.panel = new Rectangle("mission-panel");
    this.panel.width = "400px";
    this.panel.height = "340px";
    this.panel.cornerRadius = 10;
    this.panel.thickness = 1;
    this.panel.color = "rgba(0, 200, 160, 0.5)";
    this.panel.background = "rgba(0, 8, 18, 0.95)";
    this.panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.panel.left = "15px";
    this.panel.top = "-70px";
    this.panel.isVisible = false;
    gui.addControl(this.panel);

    this.container = new StackPanel("mission-content");
    this.container.width = "370px";
    this.container.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.panel.addControl(this.container);

    // Header with faction tag
    this.factionBlock = new TextBlock("mission-faction");
    this.factionBlock.color = "#00ffc8";
    this.factionBlock.fontSize = 10;
    this.factionBlock.fontFamily = "monospace";
    this.factionBlock.height = "16px";
    this.factionBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.container.addControl(this.factionBlock);

    // Header
    const header = new TextBlock("mission-header");
    header.text = "━━━ MISSION BRIEFING ━━━";
    header.color = "#00ffc8";
    header.fontSize = 11;
    header.fontFamily = "monospace";
    header.height = "20px";
    this.container.addControl(header);

    // Title
    this.titleBlock = new TextBlock("mission-title");
    this.titleBlock.color = "#ffffff";
    this.titleBlock.fontSize = 15;
    this.titleBlock.fontFamily = "monospace";
    this.titleBlock.height = "24px";
    this.titleBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.container.addControl(this.titleBlock);

    // Difficulty
    this.difficultyBlock = new TextBlock("mission-difficulty");
    this.difficultyBlock.color = "#ffcc00";
    this.difficultyBlock.fontSize = 10;
    this.difficultyBlock.fontFamily = "monospace";
    this.difficultyBlock.height = "16px";
    this.difficultyBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.container.addControl(this.difficultyBlock);

    // Briefing
    this.briefingBlock = new TextBlock("mission-briefing");
    this.briefingBlock.color = "#8899aa";
    this.briefingBlock.fontSize = 11;
    this.briefingBlock.fontFamily = "monospace";
    this.briefingBlock.textWrapping = true;
    this.briefingBlock.height = "60px";
    this.briefingBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.container.addControl(this.briefingBlock);

    // Objectives
    this.objectivesBlock = new TextBlock("mission-objectives");
    this.objectivesBlock.color = "#ccddee";
    this.objectivesBlock.fontSize = 11;
    this.objectivesBlock.fontFamily = "monospace";
    this.objectivesBlock.textWrapping = true;
    this.objectivesBlock.height = "45px";
    this.objectivesBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.container.addControl(this.objectivesBlock);

    // Intel
    this.intelBlock = new TextBlock("mission-intel");
    this.intelBlock.color = "#667799";
    this.intelBlock.fontSize = 10;
    this.intelBlock.fontFamily = "monospace";
    this.intelBlock.textWrapping = true;
    this.intelBlock.height = "30px";
    this.intelBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.container.addControl(this.intelBlock);

    // Chain indicator
    this.chainBlock = new TextBlock("mission-chain");
    this.chainBlock.color = "#aa44ff";
    this.chainBlock.fontSize = 10;
    this.chainBlock.fontFamily = "monospace";
    this.chainBlock.height = "16px";
    this.chainBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.chainBlock.isVisible = false;
    this.container.addControl(this.chainBlock);

    // Reward
    this.rewardBlock = new TextBlock("mission-reward");
    this.rewardBlock.color = "#00ffc8";
    this.rewardBlock.fontSize = 11;
    this.rewardBlock.fontFamily = "monospace";
    this.rewardBlock.height = "20px";
    this.rewardBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.container.addControl(this.rewardBlock);
  }

  /** Show a new mission briefing */
  showMission(mission: Mission): void {
    this.titleBlock.text = mission.title;
    this.titleBlock.color = "#ffffff";

    const diffColor = mission.difficulty === "critical" ? "#ff4466" :
                      mission.difficulty === "complex" ? "#ffcc00" : "#00ffc8";
    this.difficultyBlock.color = diffColor;
    this.difficultyBlock.text = `DIFFICULTY: ${mission.difficulty.toUpperCase()}`;

    // Faction tag
    if (mission.faction && FACTIONS[mission.faction]) {
      const faction = FACTIONS[mission.faction];
      this.factionBlock.text = `[${faction.tag}] ${faction.name}`;
      this.factionBlock.color = faction.color;
    } else {
      this.factionBlock.text = "";
    }

    this.briefingBlock.text = mission.briefing;

    const objLines = mission.objectives.map((o) =>
      `  ${o.completed ? "✓" : "○"} ${o.description}`
    ).join("\n");
    this.objectivesBlock.text = `OBJECTIVES:\n${objLines}`;

    this.intelBlock.text = mission.intel || "";
    this.intelBlock.isVisible = !!mission.intel;

    // Chain indicator
    if (mission.chainId && mission.chainPosition !== undefined) {
      this.chainBlock.isVisible = true;
      this.chainBlock.text = `CHAIN ACTIVE ◈ PART ${mission.chainPosition + 1}`;
    } else {
      this.chainBlock.isVisible = false;
    }

    this.rewardBlock.text = `REWARD: ${mission.reward}`;

    this.panel.isVisible = true;

    // Auto-hide after 10 seconds (longer for story content)
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      this.panel.isVisible = false;
    }, 10000);
  }

  /** Mark mission as completed with a flash */
  completeMission(mission: Mission): void {
    this.completedMissions++;
    this.parseCredits(mission.reward);

    this.titleBlock.text = `✓ ${mission.title}`;
    this.titleBlock.color = "#00ffc8";
    this.rewardBlock.text = `COMPLETED! ${mission.reward}`;

    // Flash chain bonus
    if (mission.chainId) {
      this.chainBlock.isVisible = true;
      this.chainBlock.text = "◈ CHAIN PROGRESSING ◈";
      this.chainBlock.color = "#00ffc8";
    }

    this.panel.isVisible = true;
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      this.panel.isVisible = false;
    }, 5000);

    this.updateStats();
  }

  /** Mark mission as failed */
  failMission(mission: Mission): void {
    this.titleBlock.text = `✗ ${mission.title}`;
    this.titleBlock.color = "#ff4466";
    this.rewardBlock.text = "MISSION FAILED";
    this.rewardBlock.color = "#ff4466";

    if (mission.chainId) {
      this.chainBlock.isVisible = true;
      this.chainBlock.text = "◈ CHAIN BROKEN ◈";
      this.chainBlock.color = "#ff4466";
    }

    this.panel.isVisible = true;
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      this.panel.isVisible = false;
      this.rewardBlock.color = "#00ffc8";
    }, 6000);
  }

  /** Set the stats block reference from the overlay */
  setStatsBlock(block: TextBlock): void {
    this.statsBlock = block;
    this.updateStats();
  }

  private parseCredits(reward: string): void {
    const match = reward.match(/\+(\d+)\s+city\s+credits/);
    if (match) this.totalCredits += parseInt(match[1]);
  }

  private updateStats(): void {
    if (this.statsBlock) {
      this.statsBlock.text = `MISSIONS: ${this.completedMissions}  |  CREDITS: ${this.totalCredits}`;
    }
  }
}
