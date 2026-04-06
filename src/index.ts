import { execSync } from 'node:child_process';
import { Command } from 'commander';
import chalk from 'chalk';

interface Contributor {
  name: string;
  email: string;
  commits: number;
  additions: number;
  deletions: number;
  firstCommit: string;
  lastCommit: string;
}

type SortField = 'commits' | 'additions' | 'deletions';

function runGit(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
  } catch {
    return '';
  }
}

function parseContributors(cwd: string, since?: string, until?: string): Contributor[] {
  const dateArgs: string[] = [];
  if (since) dateArgs.push(`--since="${since}"`);
  if (until) dateArgs.push(`--until="${until}"`);
  const dateStr = dateArgs.join(' ');

  // Get commit counts per author
  const shortlog = runGit(`git shortlog -sne HEAD ${dateStr}`, cwd);
  if (!shortlog.trim()) return [];

  const contributors = new Map<string, Contributor>();

  for (const line of shortlog.trim().split('\n')) {
    const match = line.trim().match(/^(\d+)\t(.+?)\s+<(.+?)>$/);
    if (!match) continue;
    const [, countStr, name, email] = match;
    contributors.set(email, {
      name,
      email,
      commits: parseInt(countStr, 10),
      additions: 0,
      deletions: 0,
      firstCommit: '',
      lastCommit: '',
    });
  }

  // Get additions/deletions per author
  const statLog = runGit(
    `git log --format="%aE" --numstat HEAD ${dateStr}`,
    cwd,
  );

  let currentEmail = '';
  for (const line of statLog.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (!trimmed.includes('\t')) {
      currentEmail = trimmed;
      continue;
    }

    const parts = trimmed.split('\t');
    if (parts.length < 2) continue;
    const added = parseInt(parts[0], 10);
    const deleted = parseInt(parts[1], 10);

    const contrib = contributors.get(currentEmail);
    if (contrib) {
      if (!isNaN(added)) contrib.additions += added;
      if (!isNaN(deleted)) contrib.deletions += deleted;
    }
  }

  // Get first and last commit dates per author
  for (const [email, contrib] of contributors) {
    const first = runGit(
      `git log --author="${email}" --format="%ai" --reverse ${dateStr} | head -1`,
      cwd,
    ).trim();
    const last = runGit(
      `git log --author="${email}" --format="%ai" -1 ${dateStr}`,
      cwd,
    ).trim();
    contrib.firstCommit = first ? first.slice(0, 10) : 'N/A';
    contrib.lastCommit = last ? last.slice(0, 10) : 'N/A';
  }

  return Array.from(contributors.values());
}

function makeBar(value: number, maxValue: number, width: number): string {
  if (maxValue === 0) return '';
  const filled = Math.round((value / maxValue) * width);
  return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(width - filled));
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
}

function printTable(contributors: Contributor[], top: number): void {
  if (contributors.length === 0) {
    console.log(chalk.yellow('\n  No contributors found.\n'));
    return;
  }

  const shown = contributors.slice(0, top);
  const totalCommits = contributors.reduce((s, c) => s + c.commits, 0);
  const maxCommits = Math.max(...shown.map((c) => c.commits));
  const maxAdditions = Math.max(...shown.map((c) => c.additions));
  const barWidth = 20;

  console.log('');
  console.log(
    chalk.bold.cyan('  Git Contributor Leaderboard'),
  );
  console.log(
    chalk.gray(`  Total: ${totalCommits} commits from ${contributors.length} contributors`),
  );
  console.log('');

  // Header
  const header = [
    chalk.gray('#'.padStart(4)),
    chalk.gray('Contributor'.padEnd(24)),
    chalk.gray('Commits'.padStart(8)),
    chalk.gray('%'.padStart(6)),
    chalk.gray('Activity'.padEnd(barWidth + 2)),
    chalk.gray('Additions'.padStart(10)),
    chalk.gray('Deletions'.padStart(10)),
    chalk.gray('First'.padEnd(12)),
    chalk.gray('Last'.padEnd(12)),
  ].join('  ');

  console.log('  ' + header);
  console.log('  ' + chalk.gray('─'.repeat(header.replace(/\x1B\[\d+m/g, '').length)));

  for (let i = 0; i < shown.length; i++) {
    const c = shown[i];
    const rank = i + 1;
    const pct = totalCommits > 0 ? ((c.commits / totalCommits) * 100).toFixed(1) : '0.0';
    const bar = makeBar(c.commits, maxCommits, barWidth);

    const rankStr =
      rank === 1
        ? chalk.yellow.bold(`${rank}`.padStart(4))
        : rank === 2
          ? chalk.white.bold(`${rank}`.padStart(4))
          : rank === 3
            ? chalk.hex('#cd7f32').bold(`${rank}`.padStart(4))
            : chalk.gray(`${rank}`.padStart(4));

    const nameStr =
      rank <= 3
        ? chalk.bold(truncate(c.name, 24).padEnd(24))
        : truncate(c.name, 24).padEnd(24);

    const row = [
      rankStr,
      nameStr,
      chalk.white(`${c.commits}`.padStart(8)),
      chalk.cyan(`${pct}%`.padStart(6)),
      bar + '  ',
      chalk.green(`+${c.additions}`.padStart(10)),
      chalk.red(`-${c.deletions}`.padStart(10)),
      chalk.gray(c.firstCommit.padEnd(12)),
      chalk.gray(c.lastCommit.padEnd(12)),
    ].join('  ');

    console.log('  ' + row);
  }

  if (contributors.length > top) {
    console.log('');
    console.log(
      chalk.gray(`  ... and ${contributors.length - top} more contributors`),
    );
  }

  console.log('');
}

const program = new Command();

program
  .name('git-contrib-cli')
  .description('Beautiful git contributor statistics and leaderboard')
  .version('1.0.0')
  .option('-d, --dir <path>', 'Path to git repository', '.')
  .option('--since <date>', 'Show contributions since date (e.g. 2024-01-01)')
  .option('--until <date>', 'Show contributions until date')
  .option('--top <n>', 'Show top N contributors', '10')
  .option('--json', 'Output as JSON')
  .option('--sort <field>', 'Sort by: commits, additions, deletions', 'commits')
  .action((options) => {
    const cwd = options.dir as string;
    const since = options.since as string | undefined;
    const until = options.until as string | undefined;
    const top = parseInt(options.top as string, 10);
    const asJson = Boolean(options.json);
    const sortField = options.sort as SortField;

    // Validate it's a git repo
    const check = runGit('git rev-parse --is-inside-work-tree', cwd);
    if (check.trim() !== 'true') {
      console.error(chalk.red(`Error: "${cwd}" is not a git repository.`));
      process.exit(1);
    }

    const contributors = parseContributors(cwd, since, until);

    // Sort
    contributors.sort((a, b) => {
      switch (sortField) {
        case 'additions':
          return b.additions - a.additions;
        case 'deletions':
          return b.deletions - a.deletions;
        case 'commits':
        default:
          return b.commits - a.commits;
      }
    });

    if (asJson) {
      console.log(JSON.stringify(contributors.slice(0, top), null, 2));
    } else {
      printTable(contributors, top);
    }
  });

program.parse();
