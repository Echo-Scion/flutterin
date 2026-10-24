import { exec } from "node:child_process";
import { promisify } from "node:util";
import chalk from "chalk";
import {
  type FlutterinProfile,
  KNOWN_TOOLS,
  PROFILE_DEFINITIONS,
  type ToolRequirement,
} from "./profiles.js";

const execAsync = promisify(exec);

export interface DetectedPackageManager {
  name: string;
  available: boolean;
}

export interface SetupAnalysis {
  profile: FlutterinProfile;
  profileName: string;
  zeroExternalDeps: boolean;
  os: "windows" | "darwin" | "linux" | "unknown";
  packageManagers: string[];
  installedTools: { tool: ToolRequirement; version: string }[];
  missingTools: { tool: ToolRequirement; required: boolean }[];
  recommendedCommands: string[];
  manualUrls: string[];
  isFullySatisfied: boolean;
}

export class FlutterinSetup {
  public static async isCommandAvailable(cmd: string): Promise<boolean> {
    try {
      await execAsync(cmd, { timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  public static async checkToolVersion(tool: ToolRequirement): Promise<{ installed: boolean; version?: string }> {
    try {
      const { stdout, stderr } = await execAsync(tool.checkCmd, { timeout: 3500 });
      const version = (stdout || stderr).trim().split(/[\r\n]+/)[0];
      if (!version.includes("Microsoft Store") && !version.includes("Python was not found")) {
        return { installed: true, version };
      }
    } catch {
      // try fallback if python
    }

    if (tool.id === "python") {
      try {
        const { stdout, stderr } = await execAsync("python3 --version", { timeout: 3500 });
        const version = (stdout || stderr).trim().split(/[\r\n]+/)[0];
        if (!version.includes("Microsoft Store") && !version.includes("Python was not found")) {
          return { installed: true, version };
        }
      } catch {
        // failure
      }
    }

    return { installed: false };
  }

  public static detectOs(): "windows" | "darwin" | "linux" | "unknown" {
    switch (process.platform) {
      case "win32":
        return "windows";
      case "darwin":
        return "darwin";
      case "linux":
        return "linux";
      default:
        return "unknown";
    }
  }

  public static async detectPackageManagers(): Promise<string[]> {
    const os = this.detectOs();
    const available: string[] = [];

    if (os === "windows") {
      if (await this.isCommandAvailable("winget --version")) available.push("winget");
      if (await this.isCommandAvailable("scoop --version")) available.push("scoop");
      if (await this.isCommandAvailable("choco --version")) available.push("choco");
    } else if (os === "darwin") {
      if (await this.isCommandAvailable("brew --version")) available.push("brew");
    } else if (os === "linux") {
      if (await this.isCommandAvailable("apt-get --version")) available.push("apt");
      if (await this.isCommandAvailable("pacman --version")) available.push("pacman");
    }

    return available;
  }

  public static async analyzeProfile(profileKey: FlutterinProfile = "web-ui"): Promise<SetupAnalysis> {
    const profileDef = PROFILE_DEFINITIONS[profileKey];
    if (!profileDef) {
      throw new Error(`Unknown profile '${profileKey}'. Available: ${Object.keys(PROFILE_DEFINITIONS).join(", ")}`);
    }

    const os = this.detectOs();
    const packageManagers = await this.detectPackageManagers();

    const installedTools: { tool: ToolRequirement; version: string }[] = [];
    const missingTools: { tool: ToolRequirement; required: boolean }[] = [];
    const recommendedCommands: string[] = [];
    const manualUrls: string[] = [];

    for (const toolId of profileDef.toolIds) {
      const tool = KNOWN_TOOLS[toolId];
      if (!tool) continue;

      const check = await this.checkToolVersion(tool);
      if (check.installed) {
        installedTools.push({ tool, version: check.version || "Installed" });
      } else {
        missingTools.push({ tool, required: tool.required });

        let commandFound = false;
        if (os === "windows") {
          const winCommands = tool.installCommands.windows;
          if (winCommands) {
            if (packageManagers.includes("winget") && winCommands.winget) {
              recommendedCommands.push(winCommands.winget);
              commandFound = true;
            } else if (packageManagers.includes("scoop") && winCommands.scoop) {
              recommendedCommands.push(winCommands.scoop);
              commandFound = true;
            } else if (packageManagers.includes("choco") && winCommands.choco) {
              recommendedCommands.push(winCommands.choco);
              commandFound = true;
            } else if (winCommands.winget) {
              recommendedCommands.push(winCommands.winget);
              commandFound = true;
            }
          }
        } else if (os === "darwin") {
          const macCommands = tool.installCommands.darwin;
          if (macCommands?.brew) {
            recommendedCommands.push(macCommands.brew);
            commandFound = true;
          }
        } else if (os === "linux") {
          const linuxCommands = tool.installCommands.linux;
          if (packageManagers.includes("apt") && linuxCommands?.apt) {
            recommendedCommands.push(linuxCommands.apt);
            commandFound = true;
          } else if (packageManagers.includes("pacman") && linuxCommands?.pacman) {
            recommendedCommands.push(linuxCommands.pacman);
            commandFound = true;
          } else if (linuxCommands?.apt) {
            recommendedCommands.push(linuxCommands.apt);
            commandFound = true;
          }
        }

        if (!commandFound && tool.installCommands.manualUrl) {
          manualUrls.push(`${tool.name}: ${tool.installCommands.manualUrl}`);
        }
      }
    }

    const hasRequiredMissing = missingTools.some((m) => m.required);

    return {
      profile: profileKey,
      profileName: profileDef.name,
      zeroExternalDeps: profileDef.zeroExternalDeps,
      os,
      packageManagers,
      installedTools,
      missingTools,
      recommendedCommands,
      manualUrls,
      isFullySatisfied: !hasRequiredMissing && missingTools.length === 0,
    };
  }

  public static printAnalysis(analysis: SetupAnalysis): void {
    const profileDef = PROFILE_DEFINITIONS[analysis.profile];
    console.log(chalk.bold.cyan(`\n🛠️  Flutterin Setup: [ ${profileDef.badge} ${analysis.profileName} ]`));
    console.log(chalk.gray(`   ${profileDef.description}\n`));

    console.log(chalk.bold(`OS Environment: ${chalk.yellow(analysis.os)} | Package Managers: ${chalk.green(analysis.packageManagers.join(", ") || "None detected")}\n`));

    console.log(chalk.bold.magenta("Installed Tools:"));
    for (const item of analysis.installedTools) {
      console.log(`  ${chalk.green("✔")} ${chalk.bold(item.tool.name)}: ${chalk.gray(item.version)} (${item.tool.desc})`);
    }

    if (analysis.missingTools.length === 0) {
      console.log(chalk.bold.green("\n🎉 All tools for this profile are ready!"));
      if (analysis.zeroExternalDeps) {
        console.log(chalk.cyan("   Notice: This profile requires ZERO external binary tools. You are ready to go.\n"));
      }
      return;
    }

    console.log(chalk.bold.yellow("\nMissing Tools for this profile:"));
    for (const item of analysis.missingTools) {
      const tag = item.required ? chalk.red("[Required]") : chalk.yellow("[Optional Provider]");
      console.log(`  ${chalk.red("✖")} ${chalk.bold(item.tool.name)} ${tag}: ${item.tool.desc}`);
    }

    if (analysis.recommendedCommands.length > 0) {
      console.log(chalk.bold.blue("\n📋 Recommended One-Liner Install Commands:"));
      for (const cmd of analysis.recommendedCommands) {
        console.log(`  ${chalk.white.bgBlack(` ${cmd} `)}`);
      }
    }

    if (analysis.manualUrls.length > 0) {
      console.log(chalk.bold.blue("\n🌐 Manual Download Links:"));
      for (const url of analysis.manualUrls) {
        console.log(`  • ${chalk.underline.cyan(url)}`);
      }
    }
    console.log("");
  }

  public static async getInstallCommandForTool(toolId: string): Promise<string | undefined> {
    const tool = KNOWN_TOOLS[toolId];
    if (!tool) return undefined;
    const os = this.detectOs();
    const packageManagers = await this.detectPackageManagers();

    if (os === "windows") {
      const win = tool.installCommands.windows;
      if (win) {
        if (packageManagers.includes("winget") && win.winget) return win.winget;
        if (packageManagers.includes("scoop") && win.scoop) return win.scoop;
        if (packageManagers.includes("choco") && win.choco) return win.choco;
        return win.winget;
      }
    } else if (os === "darwin") {
      return tool.installCommands.darwin?.brew;
    } else if (os === "linux") {
      const lin = tool.installCommands.linux;
      if (packageManagers.includes("apt") && lin?.apt) return lin.apt;
      if (packageManagers.includes("pacman") && lin?.pacman) return lin.pacman;
      return lin?.apt;
    }
    return undefined;
  }

  public static async autoFix(analysis: SetupAnalysis): Promise<void> {
    if (analysis.recommendedCommands.length === 0) {
      console.log(chalk.bold.green("\n🎉 No automatic fix commands required!"));
      return;
    }

    console.log(chalk.bold.cyan(`\n⚡ Auto-Fixing Missing Tools for [ ${analysis.profileName} ]...\n`));
    for (const cmd of analysis.recommendedCommands) {
      console.log(chalk.yellow(`Executing: ${cmd}`));
      try {
        const { stdout, stderr } = await execAsync(cmd, { timeout: 120000 });
        if (stdout) console.log(chalk.gray(stdout.trim()));
        if (stderr) console.log(chalk.gray(stderr.trim()));
        console.log(chalk.green(`✔ Command completed successfully: ${cmd}\n`));
      } catch (err: any) {
        console.error(chalk.red(`✖ Failed to execute: ${cmd}`));
        console.error(chalk.red(`  Error: ${err?.message || err}\n`));
      }
    }
  }
}
