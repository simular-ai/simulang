import { execSync } from 'node:child_process'
import { platform } from 'node:os'

const isWindows = platform() === 'win32'

const ART = String.raw`
   /\_/\
  ( o.o )   < hello from simulang!
   > ^ <
`

const COMMAND = isWindows
  ? `powershell -NoProfile -Command "Write-Output @'${ART}'@"`
  : `cat <<'EOF'${ART}EOF`

const stdout = execSync(COMMAND, {
  encoding: 'utf8',
  shell:    isWindows ? undefined : '/bin/sh',
}).trimEnd()

console.log(stdout)
