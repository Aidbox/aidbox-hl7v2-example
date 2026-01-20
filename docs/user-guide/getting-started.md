# Getting Started

<!-- TODO: Expand from README.md Quick Start section -->

## Prerequisites

- [Bun](https://bun.sh) v1.2+
- [Docker](https://docker.com) and Docker Compose

## Installation

```sh
# Clone the repository
git clone <repository-url>
cd aidbox-hl7v2-example

# Install dependencies
bun install

# Start Aidbox and PostgreSQL
docker compose up -d
```

## First Run

1. Go to http://localhost:8080 and log in with [aidbox.app](https://aidbox.app) to activate the license
2. Run database migrations:
   ```sh
   bun migrate
   ```
3. Start the web server:
   ```sh
   bun run dev
   ```

## Access Points

- **Web UI**: http://localhost:3000
- **Aidbox**: http://localhost:8080 (root / Vbro4upIT1)
- **MLLP Server**: localhost:2575 (when running `bun run mllp`)
