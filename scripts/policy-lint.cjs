#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const TOP_FILES = ["AGENTS.md", "gemini.md", "phases.md"];
const REQUIRED_SKILL_HEADINGS = [
  "## Use When",
  "## Required Inputs",
  "## Workflow",
  "## Required Outputs",
  "## Acceptance Gates",
  "## Non-Negotiables",
];
const VALID_SPRINT_STATUSES = new Set([
  "Not Started",
  "In Progress",
  "Blocked",
  "Completed",
]);

const errors = [];
const warnings = [];

function readFileSafe(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`Missing required file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function assertContains(text, needle, context) {
  if (!text.includes(needle)) {
    errors.push(`${context} is missing required content: "${needle}"`);
  }
}

function getAllSkillFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...getAllSkillFiles(full));
      continue;
    }
    if (entry.isFile() && entry.name === "SKILL.md") {
      out.push(full);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function lintTopFiles(contentsByFile) {
  assertContains(
    contentsByFile["AGENTS.md"],
    "Required Core Experience",
    "AGENTS.md"
  );
  assertContains(
    contentsByFile["AGENTS.md"],
    "Explore (search + category rails)",
    "AGENTS.md"
  );
  assertContains(
    contentsByFile["AGENTS.md"],
    "Book (intent + outcome tracking)",
    "AGENTS.md"
  );
  assertContains(contentsByFile["gemini.md"], "Data Grounding Rules", "gemini.md");
  assertContains(
    contentsByFile["gemini.md"],
    "Do not allow LLM text to define or override",
    "gemini.md"
  );
  assertContains(contentsByFile["phases.md"], "Global Sprint Rules", "phases.md");
  assertContains(
    contentsByFile["phases.md"],
    "Sprint Completion Policy",
    "phases.md"
  );

  for (const file of TOP_FILES) {
    assertContains(contentsByFile[file], "LLM", file);
    assertContains(contentsByFile[file], "RLS", file);
  }

  for (const file of ["AGENTS.md", "gemini.md", "phases.md"]) {
    assertContains(contentsByFile[file], "acceptance gates", file);
  }
}

function lintPhases(phasesText) {
  const sprintMatches = [...phasesText.matchAll(/^## Sprint \d+:/gm)];
  if (sprintMatches.length === 0) {
    errors.push("phases.md must define at least one sprint section (## Sprint N: ...).");
    return;
  }

  let inProgressCount = 0;
  for (let i = 0; i < sprintMatches.length; i += 1) {
    const start = sprintMatches[i].index;
    const end =
      i + 1 < sprintMatches.length ? sprintMatches[i + 1].index : phasesText.length;
    const section = phasesText.slice(start, end);
    const header = sprintMatches[i][0];

    assertContains(section, "**Status:**", header);
    assertContains(section, "### Entry Criteria", header);
    assertContains(section, "### Scope Checklist", header);
    assertContains(section, "### Required Deliverables", header);
    assertContains(section, "### Acceptance Gates", header);
    assertContains(section, "### Exit Criteria", header);
    assertContains(section, "### Progress Log", header);

    const statusMatch = section.match(/\*\*Status:\*\*\s*(.+)/);
    if (!statusMatch) {
      errors.push(`${header} is missing a parseable status line.`);
      continue;
    }
    const status = statusMatch[1].trim();
    if (!VALID_SPRINT_STATUSES.has(status)) {
      errors.push(`${header} has invalid status "${status}".`);
    }
    if (status === "In Progress") {
      inProgressCount += 1;
    }
  }

  if (inProgressCount > 1) {
    errors.push(
      `phases.md has ${inProgressCount} sprints marked In Progress. Maximum allowed is 1.`
    );
  }
  if (inProgressCount === 0) {
    warnings.push(
      "No sprint is currently marked In Progress. This is acceptable for planning mode."
    );
  }
}

function lintSkills() {
  const skillsDir = path.join(ROOT, ".gemini", "skills");
  const skillFiles = getAllSkillFiles(skillsDir);
  if (skillFiles.length === 0) {
    errors.push("No skill files found under .gemini/skills.");
    return { skillFiles };
  }

  for (const file of skillFiles) {
    const rel = path.relative(ROOT, file);
    const text = fs.readFileSync(file, "utf8");
    const frontmatterAware = text.replace(/^\uFEFF/, "");

    if (!/^\s*---/.test(frontmatterAware)) {
      errors.push(`${rel} is missing YAML frontmatter start (---).`);
    }
    assertContains(text, "name:", rel);
    assertContains(text, "description:", rel);

    for (const heading of REQUIRED_SKILL_HEADINGS) {
      assertContains(text, heading, rel);
    }
  }

  return { skillFiles };
}

function main() {
  const contents = {};
  for (const f of TOP_FILES) {
    contents[f] = readFileSafe(f);
  }

  lintTopFiles(contents);
  lintPhases(contents["phases.md"]);
  const { skillFiles } = lintSkills();

  console.log("Policy Lint Report");
  console.log(`- Top-level files checked: ${TOP_FILES.length}`);
  console.log(`- Skill files checked: ${skillFiles.length}`);

  if (warnings.length > 0) {
    console.log("- Warnings:");
    for (const w of warnings) {
      console.log(`  - ${w}`);
    }
  }

  if (errors.length > 0) {
    console.error("- Errors:");
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log("PASS: Policy lint checks completed with no blocking issues.");
}

main();
