import fs from 'node:fs'
import path from 'node:path'

const clientNext = path.resolve('client', '.next')
const rootNext = path.resolve('.next')

if (fs.existsSync(clientNext)) {
  try {
    if (!fs.existsSync(rootNext)) {
      try {
        fs.symlinkSync(clientNext, rootNext, 'junction')
        console.log('Successfully created symlink from client/.next to .next')
      } catch {
        fs.cpSync(clientNext, rootNext, { recursive: true })
        console.log('Successfully copied client/.next to .next')
      }
    } else {
      console.log('.next already exists at root')
    }
  } catch (err) {
    console.error('Failed to link/copy .next to root:', err)
  }
}
