import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createGitStatusReader } from '../lib/host-v18.js'

/**
 * Git 读数的**真机端到端**回归（CR-0002 评审整改 A4）。
 *
 * 前面那三个测试文件都只跑纯函数或替身；这一份真的在临时仓库里起 git：
 * 分支清单、真切换、脏工作区被拒且工作区不变、清单外被拦。**不碰本仓库、不碰用户环境**，
 * 全部在 `mkdtemp` 出来的目录里，跑完删掉。没有 git 的机器上整组跳过（而不是报红）。
 */

function hasGit() {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

const HAS_GIT = hasGit()
/** 没有 git 时把整组标成 skip，而不是留下一条失败。 */
const it = HAS_GIT ? test : test.skip

/** 与宿主 `ctx.subprocess` 同形的替身：真的起 git 子进程。 */
function realSubprocess() {
  return {
    async resolveExecutable(command) {
      return execFileSync('which', [command], { encoding: 'utf8' }).trim()
    },
    spawn(spec) {
      const child = spawn(spec.argv[0], spec.argv.slice(1), {
        cwd: spec.cwd,
        env: { ...process.env, ...(spec.env ?? {}) },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      const out = []
      const err = []
      child.stdout.on('data', (chunk) => out.push(chunk))
      child.stderr.on('data', (chunk) => err.push(chunk))
      if (spec.signal !== undefined) spec.signal.addEventListener('abort', () => child.kill('SIGKILL'))
      return {
        done: new Promise((resolve) => child.on('close', (exitCode) => resolve({ exitCode }))),
        collected: {
          stdout: { readFrom: () => ({ text: Buffer.concat(out).toString('utf8'), lossy: false }) },
          stderr: { readFrom: () => ({ text: Buffer.concat(err).toString('utf8') }) },
        },
      }
    },
  }
}

let REPO = null
const signal = () => new AbortController().signal
const git = (...args) => execFileSync('git', args, { cwd: REPO, encoding: 'utf8' }).trim()
const commit = (message) => git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', message)

before(() => {
  if (!HAS_GIT) return
  REPO = mkdtempSync(join(tmpdir(), 'dsh-sym-git-'))
  git('init', '-q', '-b', 'main', '.')
  writeFileSync(join(REPO, 'a.txt'), 'main\n')
  git('add', '-A')
  commit('main')
  // 用老写法建分支：setup 不该依赖 git 2.23 的 switch
  git('checkout', '-q', '-b', 'feat/x')
  writeFileSync(join(REPO, 'a.txt'), 'feat\n')
  git('add', '-A')
  commit('feat')
  git('checkout', '-q', 'main')
})

after(() => {
  if (REPO !== null) rmSync(REPO, { recursive: true, force: true })
})

it('真机：读取器列出本地分支，当前分支在前', async () => {
  const reader = createGitStatusReader({ subprocess: realSubprocess() })
  const payload = await reader.read(REPO, signal())
  assert.equal(payload.branch, 'main')
  assert.deepEqual(payload.branches.map((branch) => branch.name).sort(), ['feat/x', 'main'])
  assert.equal(payload.branches[0].name, 'main', '当前分支必须排第一')
  assert.equal(payload.branches[0].current, true)
})

it('真机：切换分支真的改了工作区（git 自己确认）', async () => {
  const reader = createGitStatusReader({ subprocess: realSubprocess() })
  const outcome = await reader.switchBranch(REPO, 'feat/x', signal())
  assert.equal(outcome.ok, true)
  assert.equal(git('branch', '--show-current'), 'feat/x')
  assert.equal(outcome.payload.branch, 'feat/x', '返回的读数就是切换后的')
  assert.equal(readFileSync(join(REPO, 'a.txt'), 'utf8').trim(), 'feat', '工作区文件跟着换了')
})

it('真机：工作区改动会被覆盖时 git 拒绝，且什么都不变', async () => {
  const reader = createGitStatusReader({ subprocess: realSubprocess() })
  writeFileSync(join(REPO, 'a.txt'), 'dirty\n') // 与 main 冲突的未提交改动
  const outcome = await reader.switchBranch(REPO, 'main', signal())
  assert.equal(outcome.ok, false)
  assert.equal(outcome.code, 'refused')
  assert.match(outcome.message, /a\.txt/, '被拒的理由里要指出挡路的文件')
  assert.equal(git('branch', '--show-current'), 'feat/x', '分支没变')
  assert.equal(readFileSync(join(REPO, 'a.txt'), 'utf8').trim(), 'dirty', '工作区没变')
})

it('真机：清理后切回，清单外的名字永远进不去', async () => {
  const reader = createGitStatusReader({ subprocess: realSubprocess() })
  execFileSync('git', ['checkout', '--', 'a.txt'], { cwd: REPO })
  const back = await reader.switchBranch(REPO, 'main', signal())
  assert.equal(back.ok, true)
  assert.equal(git('branch', '--show-current'), 'main')
  const remote = await reader.switchBranch(REPO, 'origin/main', signal())
  assert.equal(remote.ok, false)
  assert.equal(remote.code, 'unknown')
  assert.equal(git('branch', '--show-current'), 'main', '被拒之后分支不受影响')
})
