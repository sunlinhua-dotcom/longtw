"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const PASSCODE = "207301";

type PipelineStep = "idle" | "extracting" | "thinking" | "generating" | "done" | "error";

export default function Home() {
  const [locked, setLocked] = useState(true);
  const [passcode, setPasscode] = useState("");
  const [shaking, setShaking] = useState(false);

  const [files, setFiles] = useState<File[]>([]);
  const [brandName, setBrandName] = useState("");
  const [brief, setBrief] = useState("");
  const [step, setStep] = useState<PipelineStep>("idle");
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [thinkingOutput, setThinkingOutput] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  // Passcode logic
  useEffect(() => {
    if (passcode.length === 6) {
      if (passcode === PASSCODE) {
        // Correct — unlock with a brief delay for the dot fill animation
        setTimeout(() => setLocked(false), 300);
      } else {
        // Wrong — shake and reset
        setShaking(true);
        setTimeout(() => {
          setShaking(false);
          setPasscode("");
        }, 600);
      }
    }
  }, [passcode]);

  const handlePasscodeKey = (key: string) => {
    if (key === "delete") {
      setPasscode((p) => p.slice(0, -1));
    } else if (passcode.length < 6) {
      setPasscode((p) => p + key);
    }
  };

  const handleFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return;
    const arr = Array.from(incoming);
    setFiles((prev) => [...prev, ...arr]);
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragActive(true); };
  const handleDragLeave = () => setDragActive(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const canGenerate = brandName.trim().length > 0 && brief.trim().length > 0;

  const handleGenerate = async () => {
    setStep("extracting");
    setErrorMsg(null);
    setResultImage(null);
    setThinkingOutput(null);

    try {
      const formData = new FormData();
      formData.append("brandName", brandName);
      formData.append("brief", brief);
      files.forEach((f) => formData.append("files", f));

      // Phase 1: Extract + Think
      setStep("extracting");
      const thinkRes = await fetch("/api/think", { method: "POST", body: formData });
      if (!thinkRes.ok) {
        const err = await thinkRes.json();
        throw new Error(err.error || "品牌分析失败");
      }
      const thinkData = await thinkRes.json();
      setThinkingOutput(thinkData.prompt);
      setStep("thinking");

      // Small visual pause to show thinking step
      await new Promise((r) => setTimeout(r, 800));

      // Phase 2: Generate image
      setStep("generating");
      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: thinkData.prompt }),
      });
      if (!genRes.ok) {
        const err = await genRes.json();
        throw new Error(err.error || "图片生成失败");
      }
      const genData = await genRes.json();
      setResultImage(genData.imageBase64);
      setStep("done");
    } catch (e: unknown) {
      setStep("error");
      setErrorMsg(e instanceof Error ? e.message : "发生未知错误");
    }
  };

  const handleReset = () => {
    setStep("idle");
    setResultImage(null);
    setErrorMsg(null);
    setThinkingOutput(null);
  };

  const pipelineSteps = [
    { key: "extracting", label: "解析品牌素材", desc: "提取PDF文本与图像信息...", icon: "📄" },
    { key: "thinking", label: "AI品牌策略分析", desc: "分析品牌调性，生成定制提示词...", icon: "🧠" },
    { key: "generating", label: "4K长图生成中", desc: "Nano Banana 2 绘制1:8竖版长图...", icon: "🎨" },
  ];

  const getStepStatus = (key: string) => {
    const order = ["extracting", "thinking", "generating", "done"];
    const currentIndex = order.indexOf(step);
    const keyIndex = order.indexOf(key);
    if (step === "error") {
      if (keyIndex <= currentIndex) return "done";
      return "pending";
    }
    if (keyIndex < currentIndex) return "done";
    if (keyIndex === currentIndex) return "active";
    return "pending";
  };

  return (
    <>
      {/* iOS-style Passcode Lock Screen */}
      {locked && (
        <div className="lockscreen">
          <div className="lockscreen__content">
            <div className="lockscreen__icon">🔐</div>
            <h2 className="lockscreen__title">Super Power Studio</h2>
            <p className="lockscreen__subtitle">请输入访问密码</p>

            {/* Dot indicators */}
            <div className={`lockscreen__dots ${shaking ? "shake" : ""}`}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`lockscreen__dot ${i < passcode.length ? "filled" : ""}`}
                />
              ))}
            </div>

            {/* Number pad */}
            <div className="lockscreen__pad">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "delete"].map((key) => (
                <button
                  key={key || "empty"}
                  className={`lockscreen__key ${key === "delete" ? "lockscreen__key--text" : ""} ${key === "" ? "lockscreen__key--empty" : ""}`}
                  onClick={() => key && handlePasscodeKey(key)}
                  disabled={key === ""}
                >
                  {key === "delete" ? "⌫" : key}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main App (hidden behind lock) */}
      {!locked && (
        <div className="container">
          {/* Header */}
          <header className="header">
            <div className="header__logo">Super Power Studio</div>
            <h1 className="header__title">品牌营销长图<br />AI 一键生成</h1>
            <p className="header__subtitle">上传品牌素材 · 输入创意需求 · 即刻产出4K微信长图文</p>
          </header>

          {step === "idle" || step === "error" ? (
            <>
              {/* Upload Zone */}
              <section className="card" id="upload-section">
                <div className="card__label">📎 上传品牌素材</div>
                <div
                  className={`dropzone ${dragActive ? "active" : ""}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                  <div className="dropzone__icon">📁</div>
                  <div className="dropzone__text">点击或拖拽文件至此</div>
                  <div className="dropzone__hint">支持 PDF、PNG、JPG、WEBP（可多选）</div>
                </div>

                {files.length > 0 && (
                  <div className="file-chips">
                    {files.map((f, i) => (
                      <span key={i} className="file-chip">
                        {f.name.length > 20 ? f.name.slice(0, 18) + "…" : f.name}
                        <button className="file-chip__remove" onClick={() => removeFile(i)}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </section>

              {/* Brand Info */}
              <section className="card" id="brand-info-section">
                <div className="card__label">✨ 品牌信息</div>
                <div className="input-group">
                  <label className="input-label" htmlFor="brand-name">品牌名称 *</label>
                  <input
                    id="brand-name"
                    className="input-field"
                    type="text"
                    placeholder="例如：宫中秘策 GOONGBE"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label" htmlFor="brief">营销需求描述 *</label>
                  <textarea
                    id="brief"
                    className="input-field"
                    placeholder="例如：2026年三八妇女节微信长图文，主打妈妈护肤线，突出温柔母爱和纯净成分"
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                  />
                </div>
              </section>

              {/* Error */}
              {errorMsg && (
                <div className="error-box">⚠️ {errorMsg}</div>
              )}

              {/* Generate Button */}
              <button
                className="btn-generate"
                disabled={!canGenerate}
                onClick={handleGenerate}
                id="generate-button"
              >
                {canGenerate && <span className="btn-generate__pulse" />}
                🚀 开始生成品牌长图
              </button>
            </>
          ) : step === "done" && resultImage ? (
            /* Result View */
            <div className="result">
              <div className="result__title">✨ 品牌长图生成完毕</div>
              <div className="result__image-container">
                <img
                  className="result__image"
                  src={`data:image/png;base64,${resultImage}`}
                  alt="Generated WeChat Long Image"
                />
              </div>
              <div className="result__actions">
                <a
                  className="btn-download"
                  href={`data:image/png;base64,${resultImage}`}
                  download={`${brandName}_campaign.png`}
                >
                  ⬇️ 下载原图
                </a>
                <button className="btn-reset" onClick={handleReset}>
                  🔄 重新生成
                </button>
              </div>
            </div>
          ) : (
            /* Pipeline Progress */
            <section className="card">
              <div className="card__label">⚡ Super Power 执行中</div>
              <div className="pipeline">
                {pipelineSteps.map((s) => (
                  <div key={s.key} className={`pipeline__step ${getStepStatus(s.key)}`}>
                    <div className="pipeline__dot">
                      {getStepStatus(s.key) === "done" ? "✓" : s.icon}
                    </div>
                    <div className="pipeline__info">
                      <div className="pipeline__title">{s.label}</div>
                      <div className="pipeline__desc">{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {thinkingOutput && step !== "extracting" && (
                <div style={{
                  marginTop: '16px',
                  padding: '12px',
                  background: 'rgba(19,168,158,0.06)',
                  borderRadius: '8px',
                  border: '1px solid rgba(19,168,158,0.15)',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  maxHeight: '150px',
                  overflowY: 'auto',
                  lineHeight: 1.5,
                }}>
                  <strong style={{ color: 'var(--accent-teal)' }}>🧠 AI生成的提示词：</strong>
                  <p style={{ marginTop: '4px', whiteSpace: 'pre-wrap' }}>
                    {thinkingOutput.slice(0, 300)}{thinkingOutput.length > 300 ? "…" : ""}
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Footer */}
          <footer className="footer">
            Powered by <a href="#">Nano Banana 2</a> × <a href="#">Gemini Flash</a> · Super Power Studio
          </footer>
        </div>
      )}
    </>
  );
}
