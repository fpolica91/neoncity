import {
  AdvancedDynamicTexture,
  TextBlock,
  Rectangle,
  StackPanel,
  Button,
  Control,
  ScrollViewer,
} from "@babylonjs/gui/2D";
import type { Scene } from "@babylonjs/core/scene";
import type { SessionModel, ProjectModel } from "../../shared/protocol";

/**
 * Slide-in panel that shows session details when a building is clicked.
 */
export class SessionPanel {
  private panel: Rectangle;
  private container: StackPanel;
  private titleBlock: TextBlock;
  private infoBlocks: TextBlock[] = [];
  private visible = false;
  private gui: AdvancedDynamicTexture;

  constructor(gui: AdvancedDynamicTexture) {
    this.gui = gui;

    this.panel = new Rectangle("session-panel");
    this.panel.width = "320px";
    this.panel.height = "100%";
    this.panel.thickness = 0;
    this.panel.background = "rgba(0, 5, 15, 0.92)";
    this.panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.panel.top = "40px";
    this.panel.isVisible = false;
    gui.addControl(this.panel);

    // Border line
    const border = new Rectangle("panel-border");
    border.width = "1px";
    border.height = "100%";
    border.thickness = 0;
    border.background = "rgba(0, 200, 160, 0.3)";
    border.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.panel.addControl(border);

    this.container = new StackPanel("panel-content");
    this.container.width = "290px";
    this.container.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.panel.addControl(this.container);

    // Close button
    const closeBtn = new Button("close-btn");
    closeBtn.width = "290px";
    closeBtn.height = "30px";
    closeBtn.thickness = 0;
    closeBtn.background = "transparent";
    closeBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    closeBtn.onPointerUpObservable.add(() => this.hide());
    this.container.addControl(closeBtn);

    const closeText = new TextBlock("close-text");
    closeText.text = "X  CLOSE";
    closeText.color = "#ff4466";
    closeText.fontSize = 12;
    closeText.fontFamily = "monospace";
    closeText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    closeBtn.addControl(closeText);

    // Title
    this.titleBlock = new TextBlock("panel-title");
    this.titleBlock.color = "#00ffc8";
    this.titleBlock.fontSize = 20;
    this.titleBlock.fontFamily = "monospace";
    this.titleBlock.textWrapping = true;
    this.titleBlock.height = "40px";
    this.titleBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.container.addControl(this.titleBlock);

    // Separator
    this.addSeparator();

    // Info area (will be populated dynamically)
    for (let i = 0; i < 8; i++) {
      const block = new TextBlock(`info-${i}`);
      block.color = "#99aabb";
      block.fontSize = 13;
      block.fontFamily = "monospace";
      block.textWrapping = true;
      block.height = "24px";
      block.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      block.paddingTop = "4px";
      this.container.addControl(block);
      this.infoBlocks.push(block);
    }
  }

  show(project: ProjectModel, sessions: SessionModel[]): void {
    this.titleBlock.text = project.name.toUpperCase();

    const activeSession = sessions.find(
      (s) => s.projectId === project.id && s.status === "active"
    );

    const lines = [
      `Path: ${project.path}`,
      `Health: ${project.health.toUpperCase()}`,
      `Sessions: ${sessions.filter((s) => s.projectId === project.id).length}`,
      "",
      activeSession
        ? `Status: ${activeSession.status}`
        : "No active session",
      activeSession
        ? `Tools: ${activeSession.toolCallCount}`
        : "",
      activeSession
        ? `Errors: ${activeSession.errorCount}`
        : "",
      activeSession?.currentPrompt
        ? `Prompt: ${activeSession.currentPrompt.slice(0, 50)}...`
        : "",
    ];

    this.infoBlocks.forEach((block, i) => {
      block.text = lines[i] || "";
      if (block.text.startsWith("Health: ERROR")) {
        block.color = "#ff4466";
      } else if (block.text.startsWith("Health: WARNING")) {
        block.color = "#ffcc00";
      } else if (block.text.startsWith("Health: HEALTHY")) {
        block.color = "#00ffc8";
      } else {
        block.color = "#99aabb";
      }
    });

    this.panel.isVisible = true;
    this.visible = true;
  }

  hide(): void {
    this.panel.isVisible = false;
    this.visible = false;
  }

  get isVisible(): boolean {
    return this.visible;
  }

  private addSeparator(): void {
    const sep = new Rectangle("sep");
    sep.width = "100%";
    sep.height = "1px";
    sep.thickness = 0;
    sep.background = "rgba(0, 200, 160, 0.2)";
    sep.marginTop = "8px";
    sep.marginBottom = "8px";
    this.container.addControl(sep);
  }
}
