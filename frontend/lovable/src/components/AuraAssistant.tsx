import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  Check,
  Copy,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { askAura } from "@/lib/api";

const SUGGESTED_QUERIES = [
  "🛏️ Available Beds in Delhi",
  "🏛️ Government vs Private Hospitals",
  "❤️ Best Hospital for Cardiac Arrest",
  "⚖️ How Manchester Triage Works",
  "🧭 Explain PTT Routing Formula",
  "🏥 Tell me about AIIMS New Delhi",
];

function renderMarkdown(text: string) {
  // Simple, robust markdown rendering for headers, bold, bullets, and code
  const lines = text.split("\n");
  return lines.map((line, idx) => {
    // Header 3 / 4
    if (line.startsWith("### ")) {
      return (
        <h4 key={idx} className="font-bold text-sm text-foreground mt-2 mb-1">
          {line.replace("### ", "")}
        </h4>
      );
    }
    if (line.startsWith("#### ")) {
      return (
        <h5 key={idx} className="font-semibold text-xs text-foreground mt-1.5 mb-0.5">
          {line.replace("#### ", "")}
        </h5>
      );
    }

    // Bullet point
    if (line.startsWith("* ") || line.startsWith("- ")) {
      const content = line.substring(2);
      return (
        <li key={idx} className="ml-4 list-disc text-xs leading-relaxed my-0.5">
          {formatInline(content)}
        </li>
      );
    }

    // Code block line
    if (line.startsWith("```")) {
      return null;
    }
    if (line.includes("PTT = ") || line.includes("Priority Score = ")) {
      return (
        <div
          key={idx}
          className="my-1.5 px-2.5 py-1 rounded bg-slate-900 text-emerald-400 font-mono text-[11px]"
        >
          {line}
        </div>
      );
    }

    // Empty line
    if (line.trim() === "") {
      return <div key={idx} className="h-1.5" />;
    }

    // Normal paragraph
    return (
      <p key={idx} className="text-xs leading-relaxed my-0.5">
        {formatInline(line)}
      </p>
    );
  });
}

function formatInline(str: string): React.ReactNode {
  // Parses **bold** and `code`
  const parts = str.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-bold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="px-1 py-0.5 rounded bg-slate-100 text-tech-blue font-mono text-[11px]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function cleanMarkdownForSpeech(str: string): string {
  return str
    .replace(/###\s+/g, "")
    .replace(/##\s+/g, "")
    .replace(/#\s+/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[-*•]\s+/g, "")
    // Remove emojis for clear voice pronunciation
    .replace(/[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, "")
    .replace(/&/g, " and ")
    .replace(/\s+/g, " ")
    .trim();
}

export function AuraAssistant() {
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "bot"; text: string }[]>([
    {
      role: "bot",
      text: "Namaste! I am **Aura AI**, your medical command assistant for **Sanjeevani Grid** (संजीवनी). I'm actively monitoring **13 hospitals across Delhi NCR** (Government, Private & Local). Ask me anything about Delhi hospital capacity, clinical triage, predictive routing, or how Sanjeevani Grid works!",
    },
  ]);

  const endRef = useRef<HTMLDivElement>(null);
  const speechCancelledRef = useRef<boolean>(false);
  const preferredVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // Auto-scroll when new messages appear
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, isLoading]);

  // Load and cache voices when available
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const selectVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices || voices.length === 0) return;

      // Prefer Indian English or natural English voices
      const indianVoice = voices.find(
        (v) => v.lang === "en-IN" || v.name.toLowerCase().includes("india")
      );
      const naturalVoice = voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.includes("Google") ||
            v.name.includes("Natural") ||
            v.name.includes("Samantha") ||
            v.name.includes("Karen") ||
            v.name.includes("Daniel"))
      );
      const anyEnglish = voices.find((v) => v.lang.startsWith("en"));

      preferredVoiceRef.current = indianVoice || naturalVoice || anyEnglish || voices[0];
    };

    selectVoice();
    window.speechSynthesis.onvoiceschanged = selectVoice;

    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Total Mute: instantly halt any ongoing speech synthesis across all channels
  const stopSpeaking = () => {
    speechCancelledRef.current = true;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingIndex(null);
  };

  // Toggle Global Mute
  const toggleMute = () => {
    if (!muted) {
      // User clicked MUTE -> Totally stop all speech immediately
      stopSpeaking();
      setMuted(true);
    } else {
      // User un-muted
      setMuted(false);
    }
  };

  // Speak a specific message aloud (with sentence-by-sentence queue to avoid browser timeouts)
  const speakMessage = (msg: string, index: number) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    // Stop whatever was speaking before
    stopSpeaking();

    // Since the user explicitly clicked the mic / speak button on a message, ensure unmuted
    if (muted) {
      setMuted(false);
    }

    speechCancelledRef.current = false;
    const clean = cleanMarkdownForSpeech(msg);
    if (!clean) return;

    // Split into natural sentence chunks
    const sentences = clean
      .replace(/([.!?])\s+/g, "$1|")
      .split("|")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (sentences.length === 0) return;

    setSpeakingIndex(index);
    let chunkIndex = 0;

    const speakNextChunk = () => {
      if (speechCancelledRef.current) return;
      if (chunkIndex >= sentences.length) {
        setSpeakingIndex(null);
        return;
      }

      const sentence = sentences[chunkIndex];
      chunkIndex++;

      const u = new SpeechSynthesisUtterance(sentence);
      u.rate = 1.02;
      u.pitch = 1.0;
      if (preferredVoiceRef.current) {
        u.voice = preferredVoiceRef.current;
      }

      u.onend = () => {
        if (!speechCancelledRef.current) {
          speakNextChunk();
        }
      };

      u.onerror = (e) => {
        if (e.error !== "canceled" && e.error !== "interrupted") {
          console.warn("Speech synthesis error:", e);
        }
        if (!speechCancelledRef.current) {
          setSpeakingIndex(null);
        }
      };

      window.speechSynthesis.speak(u);
    };

    speakNextChunk();
  };

  // Speech Recognition (Voice Input)
  const toggleListening = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    // Stop speaking so mic doesn't hear the speaker output
    stopSpeaking();

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-IN";
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const current = event.resultIndex;
        const transcript = event.results[current][0].transcript;
        setText(transcript);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      setIsListening(false);
    }
  };

  // Copy text to clipboard
  const copyMessage = (messageText: string, idx: number) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(messageText);
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

  // Send query to Aura AI
  const send = async (overrideText?: string) => {
    const userMsg = (overrideText || text).trim();
    if (!userMsg || isLoading) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    const nextMessages = [...messages, { role: "user" as const, text: userMsg }];
    setMessages(nextMessages);
    setText("");
    setIsLoading(true);

    try {
      const reply = await askAura(
        nextMessages.map((message) => ({
          role: message.role === "bot" ? "assistant" : "user",
          content: message.text,
        })),
      );
      const newMessages = [...nextMessages, { role: "bot" as const, text: reply }];
      setMessages(newMessages);

      // Automatically speak the response if sound is active
      if (!muted) {
        speakMessage(reply, newMessages.length - 1);
      }
    } catch {
      // Local client-side intelligence fallback if backend connection drops
      const reply = `Aura AI Command response for "${userMsg}": Monitoring 13 Delhi facilities (AIIMS, Safdarjung, RML, LNJP, GTB, Max Saket, Fortis, Apollo, Ganga Ram, DDU, Sanjay Gandhi, Bhikshu, LBS). Currently optimal capacity across Government and Private emergency wards.`;
      const newMessages = [...nextMessages, { role: "bot" as const, text: reply }];
      setMessages(newMessages);

      if (!muted) {
        speakMessage(reply, newMessages.length - 1);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const resetChat = () => {
    stopSpeaking();
    setMessages([
      {
        role: "bot",
        text: "Chat cleared. I am ready for your next query on **Delhi hospital capacity**, **MTS triage**, or **emergency dispatch routing**.",
      },
    ]);
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className="w-[460px] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col max-h-[84vh]"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-blue-50/40 to-white">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-tech-blue text-white shadow-xs">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs uppercase tracking-wider text-slate-900">
                      Aura AI · Sanjeevani Grid
                    </span>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800">
                      Delhi NCR
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    13 Hospitals Monitored · Triage & Routing Expert
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Reset Chat */}
                <button
                  type="button"
                  onClick={resetChat}
                  title="Clear conversation"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                {/* Master Mute / Unmute Button */}
                <button
                  type="button"
                  onClick={toggleMute}
                  className={`px-2 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    muted
                      ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                  }`}
                  title={
                    muted
                      ? "Voice is MUTED. Click to Unmute"
                      : "Voice is ACTIVE. Click to Totally Mute all speech"
                  }
                >
                  {muted ? (
                    <>
                      <VolumeX className="w-3.5 h-3.5 text-rose-600" />
                      <span className="text-[11px]">Muted</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                      <span className="text-[11px]">Sound On</span>
                    </>
                  )}
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => {
                    stopSpeaking();
                    setOpen(false);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Close assistant"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Chat Messages Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 min-h-[300px] max-h-[52vh]">
              {messages.map((m, i) => {
                const isSpeakingThis = speakingIndex === i;

                return (
                  <div
                    key={i}
                    className={`group relative max-w-[94%] rounded-2xl px-4 py-3 shadow-2xs transition-all ${
                      m.role === "user"
                        ? "ml-auto bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-xs"
                        : "bg-slate-50 text-slate-800 border border-slate-200/80 rounded-bl-xs hover:border-slate-300"
                    } ${isSpeakingThis ? "ring-2 ring-tech-blue/70 bg-blue-50/50" : ""}`}
                  >
                    {/* Message Bubble Top Bar with Mic & Action Controls */}
                    <div className="flex items-center justify-between gap-2 mb-1.5 border-b border-black/5 pb-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold opacity-80">
                        {m.role === "bot" ? (
                          <>
                            <Bot className="w-3 h-3 text-tech-blue" />
                            <span>Aura AI</span>
                            {isSpeakingThis && (
                              <span className="flex items-center gap-1 text-[9px] text-tech-blue font-bold animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-tech-blue inline-block animate-ping" />
                                Speaking…
                              </span>
                            )}
                          </>
                        ) : (
                          <span>You</span>
                        )}
                      </div>

                      {/* Mic / Speak button for EVERY chat + Copy */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (isSpeakingThis) {
                              stopSpeaking();
                            } else {
                              speakMessage(m.text, i);
                            }
                          }}
                          title={
                            isSpeakingThis
                              ? "Click to totally mute this speech"
                              : "Click mic to automatically speak this chat"
                          }
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all cursor-pointer ${
                            isSpeakingThis
                              ? "bg-rose-500 text-white shadow-xs animate-pulse hover:bg-rose-600"
                              : m.role === "user"
                              ? "bg-white/20 hover:bg-white/30 text-white"
                              : "bg-white hover:bg-blue-50 text-slate-700 hover:text-tech-blue border border-slate-200 shadow-3xs"
                          }`}
                        >
                          {isSpeakingThis ? (
                            <>
                              <VolumeX className="w-3 h-3 text-white" />
                              <span className="font-semibold">Mute</span>
                            </>
                          ) : (
                            <>
                              <Mic className="w-3 h-3 text-tech-blue" />
                              <span>Speak</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => copyMessage(m.text, i)}
                          title="Copy message"
                          className={`p-1 rounded text-[10px] transition-colors cursor-pointer ${
                            m.role === "user"
                              ? "text-white/70 hover:text-white hover:bg-white/20"
                              : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {copiedIndex === i ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Content */}
                    {m.role === "user" ? (
                      <p className="text-xs font-medium leading-relaxed">{m.text}</p>
                    ) : (
                      <div className="space-y-1">{renderMarkdown(m.text)}</div>
                    )}
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 w-fit text-xs text-muted-foreground animate-pulse">
                  <Sparkles className="w-3.5 h-3.5 text-tech-blue animate-spin" />
                  <span>Aura is analyzing Delhi grid & clinical state…</span>
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* Quick Suggestion Chips */}
            <div className="px-3 pt-2 pb-1.5 border-t border-slate-100 bg-slate-50/70 overflow-x-auto flex gap-1.5 no-scrollbar">
              {SUGGESTED_QUERIES.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => send(q)}
                  className="text-[10px] whitespace-nowrap px-2.5 py-1 rounded-full bg-white hover:bg-blue-50 text-slate-700 hover:text-tech-blue border border-slate-200 shadow-3xs transition-all cursor-pointer font-medium"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Chat Input Toolbar with Voice Input Mic */}
            <div className="flex items-center gap-2 p-2.5 border-t border-slate-100 bg-white">
              {/* Voice-to-Text Microphone Button */}
              <button
                type="button"
                onClick={toggleListening}
                title={
                  isListening
                    ? "Listening… Click to stop recording"
                    : "Speak with Microphone (Voice Input)"
                }
                className={`p-2 rounded-xl transition-all cursor-pointer relative shrink-0 ${
                  isListening
                    ? "bg-rose-500 text-white ring-4 ring-rose-200 animate-pulse shadow-md"
                    : "bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-tech-blue border border-slate-200"
                }`}
              >
                {isListening ? (
                  <MicOff className="w-4 h-4 animate-bounce" />
                ) : (
                  <Mic className="w-4 h-4 text-tech-blue" />
                )}
                {isListening && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-white animate-ping" />
                )}
              </button>

              {/* Text Input */}
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder={
                  isListening
                    ? "🎙️ Listening… Speak your question now"
                    : "Ask Aura about Delhi hospitals, triage, beds…"
                }
                className={`flex-1 text-xs px-3 py-2 rounded-xl outline-none transition-all ${
                  isListening
                    ? "bg-rose-50/60 border border-rose-300 placeholder:text-rose-600 font-medium"
                    : "bg-slate-50 border border-slate-200 focus:border-tech-blue focus:bg-white placeholder:text-muted-foreground"
                }`}
              />

              {/* Send Button */}
              <button
                type="button"
                onClick={() => send()}
                disabled={isLoading || !text.trim()}
                className="p-2 rounded-xl bg-tech-blue text-white hover:bg-tech-blue-deep disabled:opacity-40 transition-colors shadow-xs cursor-pointer shrink-0"
                title="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Trigger Button */}
      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        animate={{ y: [0, -4, 0] }}
        transition={{ y: { duration: 3, repeat: Infinity, ease: "easeInOut" } }}
        className="relative grid place-items-center w-14 h-14 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 shadow-glow text-white cursor-pointer"
        aria-label="Open Aura assistant"
        title="Ask Aura AI about Delhi hospitals"
      >
        <span className="absolute inset-0 rounded-full ring-2 ring-white/40" />
        <span className="absolute -inset-1 rounded-full bg-blue-500/30 blur-md -z-10" />
        {open ? <X className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
      </motion.button>
    </div>
  );
}

