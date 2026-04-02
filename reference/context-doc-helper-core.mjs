import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

let DOC_FILENAME;
let findNearestContextDoc;
let getContextDocRepairPlan;

try {
  ({ DOC_FILENAME, getContextDocRepairPlan } = await loadModule([
    "./_socrates_context_doc.mjs",
    "./context-doc.mjs",
    "../reference/context-doc.mjs",
  ]));
  ({ findNearestContextDoc } = await loadModule([
    "./_socrates_hook_utils.mjs",
    "./hook-utils.mjs",
    "../reference/hook-utils.mjs",
  ]));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {
    command: null,
    cwd: process.cwd(),
    file: null,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    switch (current) {
      case "doctor":
      case "repair":
        if (options.command !== null) {
          throw new Error("Specify only one command: doctor or repair");
        }
        options.command = current;
        break;
      case "--cwd":
        options.cwd = requireValue(current, next);
        index += 1;
        break;
      case "--file":
        options.file = requireValue(current, next);
        index += 1;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${current}`);
    }
  }

  if (!options.help && options.command === null) {
    throw new Error("Specify a command: doctor or repair");
  }

  return options;
}

function requireValue(flag, value) {
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

async function resolveDocPath(options) {
  if (options.file) {
    return path.resolve(options.file);
  }

  const cwd = path.resolve(options.cwd);
  const target = await findNearestContextDoc(cwd);
  if (!target) {
    throw new Error(`Could not find ${DOC_FILENAME} from ${cwd}`);
  }

  return target;
}

function renderHelp(scriptPath) {
  return `Socrates context doc helper

Usage:
  node ${JSON.stringify(scriptPath)} doctor [--cwd /path]
  node ${JSON.stringify(scriptPath)} repair [--cwd /path]
  node ${JSON.stringify(scriptPath)} doctor --file /absolute/path/to/${DOC_FILENAME}
  node ${JSON.stringify(scriptPath)} repair --file /absolute/path/to/${DOC_FILENAME}
`;
}

async function runDoctor(options, scriptPath) {
  const target = await resolveDocPath(options);
  const markdown = await readFile(target, "utf8");
  const plan = getContextDocRepairPlan(markdown);

  if (plan.action === "ok") {
    process.stdout.write(`OK ${target}\n`);
    process.stdout.write(`status=${plan.state.status}\n`);
    process.stdout.write(`task=${JSON.stringify(plan.state.task)}\n`);
    return 0;
  }

  if (plan.action === "repair") {
    process.stdout.write(`REPAIR ${target}\n`);
    process.stdout.write(`reason=${plan.reason}\n`);
    process.stdout.write(`source=${plan.source}\n`);
    process.stdout.write(
      `run=node ${JSON.stringify(scriptPath)} repair --file ${JSON.stringify(target)}\n`
    );
    return 2;
  }

  process.stderr.write(`UNREPAIRABLE ${target}\n`);
  process.stderr.write(`reason=${plan.reason}\n`);
  return 1;
}

async function runRepair(options) {
  const target = await resolveDocPath(options);
  const markdown = await readFile(target, "utf8");
  const plan = getContextDocRepairPlan(markdown);

  if (plan.action === "ok") {
    process.stdout.write(`Already canonical: ${target}\n`);
    return 0;
  }

  if (plan.action === "unrepairable") {
    process.stderr.write(`Could not repair ${target}\n`);
    process.stderr.write(`reason=${plan.reason}\n`);
    return 1;
  }

  await writeFile(target, plan.markdown, "utf8");
  process.stdout.write(`Repaired ${target}\n`);
  process.stdout.write(`reason=${plan.reason}\n`);
  process.stdout.write(`source=${plan.source}\n`);
  return 0;
}

async function loadModule(candidates) {
  for (const candidate of candidates) {
    const url = new URL(candidate, import.meta.url);
    if (!(await fileExists(url))) {
      continue;
    }
    return import(url.href);
  }

  throw new Error(`Missing Socrates context helper dependency: ${candidates[0]}`);
}

async function fileExists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

export async function main(argv = process.argv.slice(2), scriptPath = fileURLToPath(import.meta.url)) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(renderHelp(scriptPath));
    return 0;
  }

  if (options.command === "doctor") {
    return runDoctor(options, scriptPath);
  }

  return runRepair(options);
}
