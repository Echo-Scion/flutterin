export type FlutterinProfile = "web-ui" | "mobile" | "native" | "full";

export interface ToolRequirement {
  id: string;
  name: string;
  desc: string;
  pillar: string;
  checkCmd: string;
  required: boolean;
  installCommands: {
    windows?: {
      winget?: string;
      scoop?: string;
      choco?: string;
    };
    darwin?: {
      brew?: string;
    };
    linux?: {
      apt?: string;
      pacman?: string;
    };
    manualUrl?: string;
  };
}

export const KNOWN_TOOLS: Record<string, ToolRequirement> = {
  node: {
    id: "node",
    name: "Node.js (LTS)",
    desc: "Node.js LTS runtime (Pure TS Converters & Decoders)",
    pillar: "Pillar 3 (JS/TS)",
    checkCmd: "node --version",
    required: true,
    installCommands: {
      windows: { winget: "winget install OpenJS.NodeJS.LTS" },
      darwin: { brew: "brew install node" },
      linux: { apt: "sudo apt install nodejs npm" },
      manualUrl: "https://nodejs.org",
    },
  },
  python: {
    id: "python",
    name: "Python 3.10+",
    desc: "Python standard library & SQLite3 engine",
    pillar: "Pillar 1 (Floor)",
    checkCmd: "python --version",
    required: true,
    installCommands: {
      windows: { winget: "winget install Python.Python.3.11" },
      darwin: { brew: "brew install python" },
      linux: { apt: "sudo apt install python3" },
      manualUrl: "https://www.python.org",
    },
  },
  flutter: {
    id: "flutter",
    name: "Flutter SDK",
    desc: "Flutter SDK for project generation & testing",
    pillar: "Core Flutter",
    checkCmd: "flutter --version",
    required: false,
    installCommands: {
      windows: { winget: "winget install Google.Flutter" },
      darwin: { brew: "brew install --cask flutter" },
      linux: { apt: "sudo snap install flutter --classic" },
      manualUrl: "https://docs.flutter.dev/get-started/install",
    },
  },
  dart: {
    id: "dart",
    name: "Dart SDK",
    desc: "Dart SDK compiler & formatter",
    pillar: "Core Flutter",
    checkCmd: "dart --version",
    required: false,
    installCommands: {
      windows: { winget: "winget install Dart.Dart" },
      darwin: { brew: "brew install dart" },
      linux: { apt: "sudo apt install dart" },
      manualUrl: "https://dart.dev/get-dart",
    },
  },
  rtk: {
    id: "rtk",
    name: "rtk",
    desc: "Rust Token Killer CLI proxy",
    pillar: "Pillar 2 (CLI)",
    checkCmd: "rtk --version",
    required: false,
    installCommands: {
      windows: { winget: "cargo install rtk-cli" },
      darwin: { brew: "cargo install rtk-cli" },
      linux: { apt: "cargo install rtk-cli" },
      manualUrl: "https://github.com/reachingforthejack/rtk",
    },
  },
  java: {
    id: "java",
    name: "Java JDK 17+",
    desc: "Java Development Kit for APK bytecode tools",
    pillar: "Pillar 4 (Mobile)",
    checkCmd: "java -version",
    required: true,
    installCommands: {
      windows: { winget: "winget install EclipseAdoptium.Temurin.17.JDK" },
      darwin: { brew: "brew install openjdk@17" },
      linux: { apt: "sudo apt install openjdk-17-jdk" },
      manualUrl: "https://adoptium.net",
    },
  },
  jadx: {
    id: "jadx",
    name: "JADX",
    desc: "Headless DEX-to-Java/Kotlin decompiler",
    pillar: "Pillar 4 (Mobile)",
    checkCmd: "jadx --version",
    required: true,
    installCommands: {
      windows: { winget: "winget install Skylot.jadx", scoop: "scoop install jadx" },
      darwin: { brew: "brew install jadx" },
      linux: { apt: "sudo apt install jadx" },
      manualUrl: "https://github.com/skylot/jadx/releases",
    },
  },
  adb: {
    id: "adb",
    name: "ADB",
    desc: "Android Debug Bridge for live screen dumps & pulling APKs",
    pillar: "Pillar 4 (Mobile)",
    checkCmd: "adb --version",
    required: false,
    installCommands: {
      windows: { winget: "winget install Google.PlatformTools" },
      darwin: { brew: "brew install android-platform-tools" },
      linux: { apt: "sudo apt install adb" },
      manualUrl: "https://developer.android.com/tools/adb",
    },
  },
  apktool: {
    id: "apktool",
    name: "Apktool",
    desc: "Android resources.arsc decoder",
    pillar: "Pillar 4 (Mobile)",
    checkCmd: "apktool -version",
    required: false,
    installCommands: {
      windows: { choco: "choco install apktool", scoop: "scoop install apktool" },
      darwin: { brew: "brew install apktool" },
      linux: { apt: "sudo apt install apktool" },
      manualUrl: "https://apktool.org/docs/install",
    },
  },
  rizin: {
    id: "rizin",
    name: "Rizin (rz-bin)",
    desc: "Rizin native binary disassembler",
    pillar: "Pillar 5 (Native)",
    checkCmd: "rz-bin -v",
    required: true,
    installCommands: {
      windows: { winget: "winget install rizinorg.rizin" },
      darwin: { brew: "brew install rizin" },
      linux: { apt: "sudo apt install rizin" },
      manualUrl: "https://rizin.re",
    },
  },
  wabt: {
    id: "wabt",
    name: "WABT (wasm2wat)",
    desc: "WebAssembly-to-WAT decompiler",
    pillar: "Pillar 5 (Native)",
    checkCmd: "wasm2wat --version",
    required: false,
    installCommands: {
      windows: { winget: "winget install WebAssembly.wabt", scoop: "scoop install wabt" },
      darwin: { brew: "brew install wabt" },
      linux: { apt: "sudo apt install wabt" },
      manualUrl: "https://github.com/WebAssembly/wabt",
    },
  },
};

export const PROFILE_DEFINITIONS: Record<
  FlutterinProfile,
  {
    name: string;
    badge: string;
    description: string;
    zeroExternalDeps: boolean;
    toolIds: string[];
  }
> = {
  "web-ui": {
    name: "Web & UI Transpiler",
    badge: "⚡ Zero-Install",
    description:
      "Converts HTML/Tailwind, React/JSX, SwiftUI, Android XML, Electron ASAR, Source Maps, HAR, and SQLite into Flutter. Zero external binary tools required.",
    zeroExternalDeps: true,
    toolIds: ["node", "python", "flutter", "dart"],
  },
  mobile: {
    name: "Mobile Package Reversing",
    badge: "📱 Mobile Suite",
    description:
      "Deep APK/AAB decompilation, resources.arsc decoding, and live ADB device screen inspection.",
    zeroExternalDeps: false,
    toolIds: ["node", "python", "flutter", "dart", "java", "jadx", "adb", "apktool"],
  },
  native: {
    name: "Native Binary & AOT Reversing",
    badge: "⚙️ Native Suite",
    description:
      "Flutter AOT libapp.so catalog matching, native ELF/PE/Mach-O symbols, and WASM decompilation.",
    zeroExternalDeps: false,
    toolIds: ["node", "python", "flutter", "dart", "rizin", "wabt"],
  },
  full: {
    name: "Complete Reversing Suite",
    badge: "🏛️ All Pillars",
    description: "All 6 Pillars and deep provider bridges enabled for a full reverse-engineering lab.",
    zeroExternalDeps: false,
    toolIds: ["node", "python", "flutter", "dart", "rtk", "java", "jadx", "apktool", "adb", "rizin", "wabt"],
  },
};
