# git-contrib-cli

Beautiful git contributor statistics and leaderboard for your terminal.

## Install

```bash
npm install -g git-contrib-cli
```

## Usage

```bash
# Run in current repo
git-contrib-cli

# Specify repo path
git-contrib-cli -d /path/to/repo

# Filter by date range
git-contrib-cli --since 2024-01-01 --until 2024-12-31

# Show top 20 contributors sorted by additions
git-contrib-cli --top 20 --sort additions

# JSON output for scripting
git-contrib-cli --json
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `-d, --dir <path>` | Path to git repository | `.` |
| `--since <date>` | Show contributions since date | — |
| `--until <date>` | Show contributions until date | — |
| `--top <n>` | Number of contributors to show | `10` |
| `--sort <field>` | Sort by: `commits`, `additions`, `deletions` | `commits` |
| `--json` | Output as JSON | `false` |

## Output

The leaderboard displays for each contributor:

- **Rank** with gold/silver/bronze highlighting for top 3
- **Name**
- **Commits** count with visual activity bar
- **Percentage** of total commits
- **Lines added / removed**
- **First and last commit** dates

## License

MIT
