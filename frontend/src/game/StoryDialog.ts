import type { StoryChapter } from "../api/client";

/**
 * Story-Dialoge werden bewusst als DOM-Overlay statt als Phaser-UI gebaut:
 * Textlastige, scrollbare Dialoge sind im DOM einfacher sauber zu layouten
 * und barrierefreier (Screenreader, Textgröße) als in Canvas/WebGL.
 */
export class StoryDialog {
  private root: HTMLDivElement;

  constructor(private onClose: () => void) {
    this.root = document.createElement("div");
    this.root.style.cssText = `
      position: fixed; inset: 0; background: rgba(10,12,18,0.92);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000; font-family: -apple-system, sans-serif; padding: 24px;
    `;
    document.body.appendChild(this.root);
  }

  showChapter(chapter: StoryChapter, opts: { isNew: boolean }) {
    const badge = opts.isNew ? "Neues Kapitel freigeschaltet" : "Aktuelles Kapitel";
    this.root.innerHTML = `
      <div style="max-width: 480px; background:#181c24; border:1px solid #2c3140; border-radius:16px;
                  padding:24px; color:#f0f0f0; box-shadow:0 20px 60px rgba(0,0,0,0.5);">
        <div style="font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:#ffd23f; margin-bottom:8px;">
          Kapitel ${chapter.order} · ${badge}
        </div>
        <h2 style="margin:0 0 14px 0; font-size:22px;">${chapter.title}</h2>
        <p style="line-height:1.5; color:#d8dce4; margin-bottom:16px;">${chapter.intro}</p>
        <p style="line-height:1.5; color:#9aa3b5; font-style:italic; border-left:3px solid #36c2ff; padding-left:10px;">
          ${chapter.cliffhanger}
        </p>
        <button id="story-dialog-close" style="margin-top:20px; width:100%; padding:12px; border:none;
                border-radius:10px; background:#36c2ff; color:#08131c; font-weight:600; font-size:15px; cursor:pointer;">
          Weiterspielen
        </button>
      </div>
    `;
    this.root.style.display = "flex";
    this.root.querySelector("#story-dialog-close")!.addEventListener("click", () => {
      this.hide();
      this.onClose();
    });
  }

  hide() {
    this.root.style.display = "none";
  }

  destroy() {
    this.root.remove();
  }
}
