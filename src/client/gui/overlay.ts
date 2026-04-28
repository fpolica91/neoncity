import {
  AdvancedDynamicTexture,
  TextBlock,
  Rectangle,
  StackPanel,
  Button,
  InputText,
  Control,
} from "@babylonjs/gui/2D";
import type { Scene } from "@babylonjs/core/scene";

export function createOverlay(scene: Scene): AdvancedDynamicTexture {
  const gui = AdvancedDynamicTexture.CreateFullscreenUI("overlay");

  // Top status bar
  const topBar = new Rectangle("top-bar");
  topBar.width = "100%";
  topBar.height = "40px";
  topBar.thickness = 0;
  topBar.background = "rgba(0, 5, 15, 0.85)";
  topBar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  topBar.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  gui.addControl(topBar);

  const title = new TextBlock("title");
  title.text = "NEONCITY";
  title.color = "#00ffc8";
  title.fontSize = 16;
  title.fontFamily = "monospace";
  title.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  title.left = "15px";
  title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  topBar.addControl(title);

  const statusText = new TextBlock("status-text");
  statusText.text = "CONNECTING...";
  statusText.color = "#555";
  statusText.fontSize = 13;
  statusText.fontFamily = "monospace";
  statusText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  statusText.left = "-15px";
  statusText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  topBar.addControl(statusText);

  // Stats display (missions completed, credits)
  const statsText = new TextBlock("stats-text");
  statsText.text = "MISSIONS: 0  |  CREDITS: 0";
  statsText.color = "#667788";
  statsText.fontSize = 12;
  statsText.fontFamily = "monospace";
  statsText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  statsText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  topBar.addControl(statsText);

  // Chat input bar at bottom
  const chatBar = new Rectangle("chat-bar");
  chatBar.width = "60%";
  chatBar.height = "44px";
  chatBar.cornerRadius = 8;
  chatBar.thickness = 1;
  chatBar.color = "rgba(0, 200, 160, 0.4)";
  chatBar.background = "rgba(0, 10, 20, 0.9)";
  chatBar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  chatBar.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  chatBar.top = "-15px";
  gui.addControl(chatBar);

  const promptSymbol = new TextBlock("prompt-symbol");
  promptSymbol.text = ">";
  promptSymbol.color = "#00ffc8";
  promptSymbol.fontSize = 18;
  promptSymbol.fontFamily = "monospace";
  promptSymbol.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  promptSymbol.left = "12px";
  promptSymbol.width = "20px";
  chatBar.addControl(promptSymbol);

  const chatInput = new InputText("chat-input");
  chatInput.width = "85%";
  chatInput.height = "36px";
  chatInput.color = "#e0e0e0";
  chatInput.fontSize = 14;
  chatInput.fontFamily = "monospace";
  chatInput.background = "transparent";
  chatInput.focusedBackground = "transparent";
  chatInput.placeholderText = "Send a prompt to Claude Code...";
  chatInput.placeholderColor = "#446";
  chatInput.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT.LEFT;
  chatInput.left = "32px";
  chatInput.thickness = 0;
  chatBar.addControl(chatInput);

  const sendBtn = new Button("send-btn");
  sendBtn.width = "60px";
  sendBtn.height = "32px";
  sendBtn.cornerRadius = 6;
  sendBtn.thickness = 0;
  sendBtn.background = "rgba(0, 200, 160, 0.3)";
  sendBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  sendBtn.left = "-6px";
  chatBar.addControl(sendBtn);

  const sendText = new TextBlock("send-text");
  sendText.text = "SEND";
  sendText.color = "#00ffc8";
  sendText.fontSize = 12;
  sendText.fontFamily = "monospace";
  sendBtn.addControl(sendText);

  return gui;
}
