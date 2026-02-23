import { readFileSync, writeFileSync } from 'fs';

const file = 'client/src/pages/Arena.jsx';
let src = readFileSync(file, 'utf8');

// ─── 1. Replace result-panel IIFE in ResizablePanels ────────────────────────

const newIIFE = `      {submissionStatus && (() => {
        const v   = submissionStatus.status;
        const vs  = vStyle(v);
        const isCE      = v === 'Compilation Error';
        const isLoading = v === 'processing' || v === 'pending';
        return (
          <div
            style={{ height: \`\${100 - editorHeight}%\`, transition: isDragging.current ? 'none' : 'height 0.25s ease', backgroundColor: 'var(--lc-card)', borderTop: \`2px solid \${vs.border}\` }}
            className="flex flex-col overflow-hidden"
          >
            {/* Verdict header */}
            <div className="flex items-center justify-between px-5 py-3 shrink-0"
              style={{ backgroundColor: vs.bg, borderBottom: \`1px solid \${vs.border}\` }}>
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm"
                  style={{ backgroundColor: vs.bg, border: \`1px solid \${vs.border}\`, color: vs.color }}>
                  {vs.icon}
                </span>
                <div>
                  <p className="font-black text-sm font-mono uppercase tracking-widest" style={{ color: vs.color }}>{v}</p>
                  {submissionStatus.message && <p className="text-[11px] text-gray-500 font-mono mt-0.5">{submissionStatus.message}</p>}
                </div>
              </div>
              {v === 'Accepted' && (submissionStatus.runtime || submissionStatus.memory) && (
                <div className="flex items-center gap-2.5">
                  {submissionStatus.runtime && (
                    <div className="px-3 py-1.5 rounded-lg text-center" style={{ backgroundColor: 'var(--lc-nav)', border: '1px solid var(--lc-border)' }}>
                      <p className="text-[9px] text-gray-500 font-mono uppercase tracking-wider">Runtime</p>
                      <p className="text-sm font-black font-mono" style={{ color: '#00b8a3' }}>{submissionStatus.runtime}</p>
                    </div>
                  )}
                  {submissionStatus.memory && (
                    <div className="px-3 py-1.5 rounded-lg text-center" style={{ backgroundColor: 'var(--lc-nav)', border: '1px solid var(--lc-border)' }}>
                      <p className="text-[9px] text-gray-500 font-mono uppercase tracking-wider">Memory</p>
                      <p className="text-sm font-black font-mono" style={{ color: '#00b8a3' }}>{submissionStatus.memory}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Compiler output */}
            {isCE && submissionStatus.compilationError && (
              <div className="px-5 py-3 shrink-0" style={{ borderBottom: '1px solid var(--lc-border)' }}>
                <p className="text-[10px] font-mono font-bold text-orange-400 uppercase tracking-widest mb-2">Compiler Output</p>
                <pre className="text-xs font-mono text-red-300 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap"
                  style={{ backgroundColor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(248,113,113,0.2)' }}>
                  {submissionStatus.compilationError}
                </pre>
              </div>
            )}

            {/* Loading spinner */}
            {isLoading && !submissionStatus.testResults && (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative w-10 h-10">
                    <div className="absolute inset-0 rounded-full border-2 border-[#ffa116]/20 animate-ping" />
                    <div className="w-10 h-10 rounded-full border-2 border-t-transparent border-[#ffa116] animate-spin" />
                  </div>
                  <p className="text-xs font-mono font-bold text-gray-400 uppercase tracking-widest">Running test cases...</p>
                </div>
              </div>
            )}

            {/* Test Results */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
              {submissionStatus.testResults ? (
                submissionStatus.testResults.map((test, index) => (
                  <div key={index} className="rounded-xl overflow-hidden"
                    style={{ border: \`1px solid \${test.passed ? 'rgba(0,184,163,0.25)' : 'rgba(248,113,113,0.25)'}\`, backgroundColor: test.passed ? 'rgba(0,184,163,0.04)' : 'rgba(248,113,113,0.04)' }}>
                    <div className="flex items-center justify-between px-4 py-2.5"
                      style={{ borderBottom: test.passed ? '1px solid rgba(0,184,163,0.15)' : '1px solid rgba(248,113,113,0.15)' }}>
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black"
                          style={{ backgroundColor: test.passed ? 'rgba(0,184,163,0.15)' : 'rgba(248,113,113,0.15)', color: test.passed ? '#00b8a3' : '#f87171' }}>
                          {test.passed ? '✓' : '✗'}
                        </span>
                        <span className="text-xs font-mono font-bold" style={{ color: test.passed ? '#00b8a3' : '#f87171' }}>Test {test.testCase}</span>
                        {test.time && <span className="text-[10px] font-mono text-gray-500">{test.time}</span>}
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase"
                        style={{ backgroundColor: test.passed ? 'rgba(0,184,163,0.12)' : 'rgba(248,113,113,0.12)', color: test.passed ? '#00b8a3' : '#f87171' }}>
                        {test.verdict}
                      </span>
                    </div>
                    {!test.passed && !isCE && (
                      <div className="px-4 py-3 space-y-2">
                        <div className="flex items-start gap-2 text-xs font-mono">
                          <span className="text-amber-400 font-bold shrink-0 w-16">Expected</span>
                          <code className="px-2 py-0.5 rounded break-all" style={{ backgroundColor: 'var(--lc-nav)', color: '#a5b4fc', border: '1px solid var(--lc-border)' }}>{test.expectedOutput}</code>
                        </div>
                        <div className="flex items-start gap-2 text-xs font-mono">
                          <span className="text-red-400 font-bold shrink-0 w-16">Got</span>
                          <code className="px-2 py-0.5 rounded break-all" style={{ backgroundColor: 'var(--lc-nav)', color: '#f87171', border: '1px solid var(--lc-border)' }}>{test.actualOutput || '(no output)'}</code>
                        </div>
                        {test.stderr && (
                          <div className="flex items-start gap-2 text-xs font-mono">
                            <span className="text-orange-400 font-bold shrink-0 w-16">Stderr</span>
                            <pre className="text-orange-300 text-xs rounded p-2 overflow-x-auto whitespace-pre-wrap flex-1"
                              style={{ backgroundColor: 'rgba(0,0,0,0.35)', border: '1px solid rgba(249,115,22,0.2)' }}>{test.stderr}</pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              ) : null}
            </div>
          </div>
        );
      })()}`;

src = readFileSync(file, 'utf8');

const startIdx = src.indexOf("      {submissionStatus && (() => {\n        const v = submissionStatus.status;\n        const isAccepted");
const endIdx   = src.indexOf("      })()}\n    </div>\n  );\n};");
if (startIdx === -1) { console.error('start not found'); process.exit(1); }
if (endIdx === -1)   { console.error('end not found'); process.exit(1); }

const endOfEnd = endIdx + "      })()}\n    </div>\n  );\n};".length;
src = src.slice(0, startIdx) + newIIFE + '\n    </div>\n  );\n};' + src.slice(endOfEnd);
console.log('Section 1 replaced. New length:', src.length);

writeFileSync(file, src, 'utf8');
console.log('Done section 1');
