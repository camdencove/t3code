T3 Code with workspaces: separate environments for each client or project, switched from the sidebar.

## Desktop app

| Platform            | Download                 |
| ------------------- | ------------------------ |
| Windows x64         | `.exe` installer         |
| macOS Apple Silicon | `.dmg`                   |
| Linux x64           | `x86_64.AppImage`        |
| Linux arm64         | `arm64.AppImage`         |

These builds are unsigned. On Windows choose **More info**, then **Run anyway**. On macOS allow the app under **System Settings → Privacy & Security**.

## Server CLI

```bash
curl -fsSL https://raw.githubusercontent.com/camdencove/t3code/main/scripts/install.sh | sh
```

Or connect from the desktop app over SSH, which installs the matching CLI on the server for you. See the [README](https://github.com/camdencove/t3code#run-it-on-a-server).

`SHA256SUMS` covers every file in this release.
