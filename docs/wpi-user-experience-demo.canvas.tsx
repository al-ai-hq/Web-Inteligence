import { Presentation, PresentationSlide, PresentationFragment } from "qoder/canvas";

export default function WPIUserExperienceDemo() {
  return (
    <Presentation
      loop
      transition="fade"
      keyboard="global"
      progress
      height="100vh"
      style={{ background: "#ffffff" }}
    >
      {/* Slide 1: Title */}
      <PresentationSlide
        id="title"
        title="WPI - See How AI Reads Your Website"
        background={{
          color: "#ffffff",
          pattern: "dots",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            textAlign: "center",
            padding: "4rem",
          }}
        >
          <PresentationFragment effect="fade-up">
            <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🔍</div>
          </PresentationFragment>
          <PresentationFragment effect="fade-up" index={1}>
            <h1
              style={{
                fontSize: "3.5rem",
                fontWeight: 700,
                color: "#111",
                margin: "0 0 1rem 0",
                lineHeight: 1.2,
              }}
            >
              See How AI Engines
              <br />
              Read Your Website
            </h1>
          </PresentationFragment>
          <PresentationFragment effect="fade-up" index={2}>
            <p
              style={{ fontSize: "1.5rem", color: "#666", margin: "0 0 2rem 0", maxWidth: "600px" }}
            >
              Free audit in 60 seconds. No signup required.
            </p>
          </PresentationFragment>
          <PresentationFragment effect="grow" index={3}>
            <div
              style={{
                padding: "1rem 2rem",
                background: "#111",
                borderRadius: "8px",
                fontSize: "1.2rem",
                fontWeight: 600,
                color: "#fff",
              }}
            >
              Start Your Free Audit →
            </div>
          </PresentationFragment>
        </div>
      </PresentationSlide>

      {/* Slide 2: Landing Page */}
      <PresentationSlide id="landing" title="Simple Landing Page" background={{ color: "#fafafa" }}>
        <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "3rem" }}>
          <PresentationFragment effect="fade-down">
            <div style={{ textAlign: "center", marginBottom: "2rem" }}>
              <h2 style={{ fontSize: "2rem", color: "#111", margin: 0 }}>
                Your Website, Analyzed by AI
              </h2>
              <p style={{ color: "#666", fontSize: "1.1rem" }}>
                Enter your URL and get instant insights
              </p>
            </div>
          </PresentationFragment>
          <PresentationFragment effect="fade-up" index={1}>
            <div
              style={{
                maxWidth: "700px",
                margin: "0 auto",
                width: "100%",
                background: "#fff",
                borderRadius: "12px",
                padding: "2rem",
                border: "1px solid #e5e5e5",
              }}
            >
              <div style={{ marginBottom: "1.5rem" }}>
                <label
                  style={{
                    display: "block",
                    color: "#333",
                    marginBottom: "0.5rem",
                    fontSize: "0.9rem",
                    fontWeight: 500,
                  }}
                >
                  Your website URL *
                </label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    type="text"
                    value="https://example.com"
                    readOnly
                    style={{
                      flex: 1,
                      padding: "0.75rem",
                      background: "#fff",
                      border: "1px solid #d5d5d5",
                      borderRadius: "6px",
                      color: "#111",
                      fontSize: "1rem",
                    }}
                  />
                  <button
                    style={{
                      padding: "0.75rem 1.5rem",
                      background: "#111",
                      border: "none",
                      borderRadius: "6px",
                      color: "#fff",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Run Audit
                  </button>
                </div>
              </div>
              <PresentationFragment effect="fade-up" index={2}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label
                      style={{
                        display: "block",
                        color: "#666",
                        marginBottom: "0.5rem",
                        fontSize: "0.85rem",
                      }}
                    >
                      Organization Name
                    </label>
                    <div
                      style={{
                        padding: "0.6rem",
                        background: "#fafafa",
                        border: "1px solid #e5e5e5",
                        borderRadius: "6px",
                        color: "#999",
                        fontSize: "0.9rem",
                      }}
                    >
                      Optional
                    </div>
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        color: "#666",
                        marginBottom: "0.5rem",
                        fontSize: "0.85rem",
                      }}
                    >
                      Business Type
                    </label>
                    <div
                      style={{
                        padding: "0.6rem",
                        background: "#fafafa",
                        border: "1px solid #e5e5e5",
                        borderRadius: "6px",
                        color: "#999",
                        fontSize: "0.9rem",
                      }}
                    >
                      Select...
                    </div>
                  </div>
                </div>
              </PresentationFragment>
            </div>
          </PresentationFragment>
          <PresentationFragment effect="fade-up" index={3}>
            <div
              style={{ textAlign: "center", marginTop: "2rem", color: "#666", fontSize: "0.9rem" }}
            >
              ✓ Free forever &nbsp; ✓ No signup &nbsp; ✓ Results in 60 seconds
            </div>
          </PresentationFragment>
        </div>
      </PresentationSlide>

      {/* Slide 3: Processing */}
      <PresentationSlide id="processing" title="Audit Processing" background={{ color: "#ffffff" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            padding: "3rem",
          }}
        >
          <PresentationFragment effect="fade">
            <h2 style={{ fontSize: "2rem", color: "#111", marginBottom: "3rem" }}>
              Analyzing Your Website...
            </h2>
          </PresentationFragment>
          <PresentationFragment effect="fade-up" index={1}>
            <div style={{ width: "100%", maxWidth: "600px" }}>
              {[
                "Crawling pages",
                "Checking SEO structure",
                "Analyzing AI visibility",
                "Generating report",
              ].map((step, i) => (
                <PresentationFragment key={step} effect="fade-right" index={i + 2}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "1rem",
                      marginBottom: "0.75rem",
                      background: i === 0 ? "#f0fdf4" : "#fff",
                      borderRadius: "8px",
                      border: `1px solid ${i === 0 ? "#22c55e" : "#e5e5e5"}`,
                    }}
                  >
                    <div
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        background: i === 0 ? "#22c55e" : i === 1 ? "#3b82f6" : "#e5e5e5",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: "1rem",
                        fontSize: "0.8rem",
                        color: i === 0 || i === 1 ? "#fff" : "#999",
                      }}
                    >
                      {i === 0 ? "✓" : i + 1}
                    </div>
                    <span
                      style={{
                        color: i === 0 ? "#22c55e" : i === 1 ? "#3b82f6" : "#666",
                        fontSize: "1.1rem",
                        fontWeight: i === 1 ? 500 : 400,
                      }}
                    >
                      {step}
                    </span>
                    {i === 0 && (
                      <span style={{ marginLeft: "auto", color: "#22c55e", fontSize: "0.9rem" }}>
                        Complete
                      </span>
                    )}
                    {i === 1 && (
                      <span style={{ marginLeft: "auto", color: "#3b82f6", fontSize: "0.9rem" }}>
                        In progress...
                      </span>
                    )}
                  </div>
                </PresentationFragment>
              ))}
            </div>
          </PresentationFragment>
          <PresentationFragment effect="fade-up" index={6}>
            <div
              style={{
                marginTop: "2rem",
                padding: "1rem 2rem",
                background: "#fff",
                borderRadius: "8px",
                border: "1px solid #e5e5e5",
              }}
            >
              <span style={{ color: "#666" }}>Estimated time: </span>
              <span style={{ color: "#3b82f6", fontWeight: 600 }}>~45 seconds</span>
            </div>
          </PresentationFragment>
        </div>
      </PresentationSlide>

      {/* Slide 4: Results Dashboard */}
      <PresentationSlide id="results" title="Audit Results" background={{ color: "#fafafa" }}>
        <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "3rem" }}>
          <PresentationFragment effect="fade-down">
            <div style={{ textAlign: "center", marginBottom: "2rem" }}>
              <h2 style={{ fontSize: "2rem", color: "#111", margin: "0 0 0.5rem 0" }}>
                Your Audit Results
              </h2>
              <p style={{ color: "#666" }}>example.com • Generated just now</p>
            </div>
          </PresentationFragment>
          <PresentationFragment effect="grow" index={1}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "2rem" }}>
              <div
                style={{
                  width: "180px",
                  height: "180px",
                  borderRadius: "50%",
                  background: "conic-gradient(#22c55e 0deg 252deg, #e5e5e5 252deg 360deg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    width: "150px",
                    height: "150px",
                    borderRadius: "50%",
                    background: "#fafafa",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div style={{ fontSize: "3rem", fontWeight: 700, color: "#22c55e" }}>70</div>
                  <div style={{ fontSize: "0.9rem", color: "#666" }}>out of 100</div>
                </div>
              </div>
            </div>
          </PresentationFragment>
          <PresentationFragment effect="fade-up" index={2}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "1rem",
                maxWidth: "800px",
                margin: "0 auto",
                width: "100%",
              }}
            >
              {[
                { label: "SEO Score", value: "75", color: "#22c55e" },
                { label: "AI Visibility", value: "62", color: "#f59e0b" },
                { label: "Performance", value: "88", color: "#22c55e" },
              ].map((metric) => (
                <div
                  key={metric.label}
                  style={{
                    background: "#fff",
                    padding: "1.5rem",
                    borderRadius: "8px",
                    border: "1px solid #e5e5e5",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "2rem", fontWeight: 700, color: metric.color }}>
                    {metric.value}
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "#666", marginTop: "0.5rem" }}>
                    {metric.label}
                  </div>
                </div>
              ))}
            </div>
          </PresentationFragment>
          <PresentationFragment effect="fade-up" index={3}>
            <div style={{ textAlign: "center", marginTop: "2rem" }}>
              <button
                style={{
                  padding: "1rem 2rem",
                  background: "#111",
                  border: "none",
                  borderRadius: "6px",
                  color: "#fff",
                  fontSize: "1.1rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                View Full Report →
              </button>
            </div>
          </PresentationFragment>
        </div>
      </PresentationSlide>

      {/* Slide 5: Detailed Findings */}
      <PresentationSlide id="findings" title="Detailed Findings" background={{ color: "#ffffff" }}>
        <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "3rem" }}>
          <PresentationFragment effect="fade-down">
            <h2
              style={{ fontSize: "2rem", color: "#111", margin: "0 0 2rem 0", textAlign: "center" }}
            >
              Key Findings
            </h2>
          </PresentationFragment>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1.5rem",
              maxWidth: "900px",
              margin: "0 auto",
              width: "100%",
            }}
          >
            <PresentationFragment effect="fade-right" index={1}>
              <div
                style={{
                  background: "#fff",
                  padding: "1.5rem",
                  borderRadius: "8px",
                  border: "2px solid #22c55e",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", marginBottom: "0.75rem" }}>
                  <span style={{ fontSize: "1.5rem", marginRight: "0.75rem", color: "#22c55e" }}>
                    ✓
                  </span>
                  <span style={{ color: "#22c55e", fontWeight: 600, fontSize: "1.1rem" }}>
                    Strong Points
                  </span>
                </div>
                <ul style={{ color: "#333", margin: 0, paddingLeft: "1.5rem", lineHeight: 1.8 }}>
                  <li>Mobile-friendly design</li>
                  <li>Fast page load times</li>
                  <li>SSL certificate active</li>
                  <li>Clear site structure</li>
                </ul>
              </div>
            </PresentationFragment>
            <PresentationFragment effect="fade-left" index={1}>
              <div
                style={{
                  background: "#fffbeb",
                  padding: "1.5rem",
                  borderRadius: "8px",
                  border: "2px solid #f59e0b",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", marginBottom: "0.75rem" }}>
                  <span style={{ fontSize: "1.5rem", marginRight: "0.75rem", color: "#d97706" }}>
                    ⚠
                  </span>
                  <span style={{ color: "#d97706", fontWeight: 600, fontSize: "1.1rem" }}>
                    Improvements
                  </span>
                </div>
                <ul style={{ color: "#333", margin: 0, paddingLeft: "1.5rem", lineHeight: 1.8 }}>
                  <li>Add structured data markup</li>
                  <li>Optimize meta descriptions</li>
                  <li>Improve internal linking</li>
                  <li>Add FAQ schema</li>
                </ul>
              </div>
            </PresentationFragment>
          </div>
          <PresentationFragment effect="fade-up" index={2}>
            <div
              style={{
                textAlign: "center",
                marginTop: "2rem",
                padding: "1.5rem",
                background: "#fff",
                borderRadius: "8px",
                border: "1px solid #e5e5e5",
                maxWidth: "700px",
                margin: "2rem auto 0",
              }}
            >
              <p style={{ color: "#111", fontSize: "1.1rem", margin: "0 0 1rem 0" }}>
                <strong>AI engines can better understand your site</strong> with these quick fixes
              </p>
              <button
                style={{
                  padding: "0.75rem 1.5rem",
                  background: "#111",
                  border: "none",
                  borderRadius: "6px",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Get Detailed Recommendations
              </button>
            </div>
          </PresentationFragment>
        </div>
      </PresentationSlide>

      {/* Slide 6: Call to Action */}
      <PresentationSlide
        id="cta"
        title="Start Your Audit"
        background={{
          color: "#ffffff",
          pattern: "dots",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            textAlign: "center",
            padding: "4rem",
          }}
        >
          <PresentationFragment effect="fade-up">
            <h1 style={{ fontSize: "3rem", fontWeight: 700, color: "#111", margin: "0 0 1rem 0" }}>
              Ready to See Your Score?
            </h1>
          </PresentationFragment>
          <PresentationFragment effect="fade-up" index={1}>
            <p
              style={{ fontSize: "1.3rem", color: "#666", margin: "0 0 2rem 0", maxWidth: "600px" }}
            >
              Join thousands of website owners optimizing for AI search
            </p>
          </PresentationFragment>
          <PresentationFragment effect="grow" index={2}>
            <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem" }}>
              <div
                style={{
                  padding: "1.25rem 2rem",
                  background: "#111",
                  borderRadius: "8px",
                  fontSize: "1.2rem",
                  fontWeight: 600,
                  color: "#fff",
                }}
              >
                Run Free Audit →
              </div>
            </div>
          </PresentationFragment>
          <PresentationFragment effect="fade-up" index={3}>
            <div style={{ display: "flex", gap: "2rem", color: "#666", fontSize: "0.95rem" }}>
              <span>✓ 100% Free</span>
              <span>✓ No Credit Card</span>
              <span>✓ Instant Results</span>
              <span>✓ Actionable Insights</span>
            </div>
          </PresentationFragment>
        </div>
      </PresentationSlide>
    </Presentation>
  );
}
