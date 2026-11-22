# Body Debugger

Desktop tray app for short desk workouts. One popup = one exercise.

- Source: [proto0654/body-debugger](https://github.com/proto0654/body-debugger)
- Release feed: [proto0654/body-debugger-releases](https://github.com/proto0654/body-debugger-releases)
- Agent entry: [AGENTS.md](AGENTS.md)
- Docs hub: [docs/README.md](docs/README.md)
- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) ([root stub](ARCHITECTURE.md))
- Product concept (Russian): [CONCEPT.md](CONCEPT.md)

```bash
npm run dev
```

Platforms: Windows (per-user NSIS) and macOS Apple Silicon are the shipped channels with in-app updates; Linux x64 builds a portable AppImage with `npm run build:linux` — see [docs/DELIVERY.md](docs/DELIVERY.md#linux-appimage).

Caches and Electron binary stay on `E:` — see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).
