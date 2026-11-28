import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

if (process.platform === 'linux' && process.arch === 'x64') {
  const required = [
    '@rollup/rollup-linux-x64-gnu',
    '@tailwindcss/oxide-linux-x64-gnu',
    'lightningcss-linux-x64-gnu',
  ]
  const missing = required.filter(
    (pkg) =>
      !fs.existsSync(path.resolve('node_modules', pkg)) &&
      !fs.existsSync(path.resolve('..', 'node_modules', pkg))
  )
  if (missing.length > 0) {
    console.log('Installing missing Linux native build dependencies:', missing.join(', '))
    execSync(`npm install --no-save --no-package-lock --no-audit --no-fund ${missing.join(' ')}`, {
      stdio: 'inherit',
    })
  }
}
