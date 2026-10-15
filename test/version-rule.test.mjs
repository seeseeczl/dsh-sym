import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  parseVersion, isValidVersion, nextVersion, versionFromTag, looksLikeVersionTag,
  latestVersion, checkVersionAgainst, SEGMENT_MAX,
} from '../scripts/version-rule.mjs'

test('版本号规则：三段、每段最多两位数字、不接受前导零', () => {
  assert.equal(SEGMENT_MAX, 99)
  assert.equal(isValidVersion('0.0.1'), true)
  assert.equal(isValidVersion('1.8.1'), true)
  assert.equal(isValidVersion('99.99.99'), true)
  assert.equal(isValidVersion('1.8.100'), false, '段超过两位应被拒')
  assert.equal(isValidVersion('100.8.1'), false)
  assert.equal(isValidVersion('01.8.1'), false, '前导零应被拒')
  assert.equal(isValidVersion('1.08.1'), false)
  assert.equal(isValidVersion('1.8'), false, '段数不足应被拒')
  assert.equal(isValidVersion('1.8.1.2'), false, '段数过多应被拒')
  assert.equal(isValidVersion('a.b.c'), false)
  assert.equal(isValidVersion('1.8.-1'), false)
  assert.equal(isValidVersion(''), false)
  assert.equal(isValidVersion(null), false)
  assert.deepEqual(parseVersion(' 1.8.1 '), [1, 8, 1], '两端空白应被容忍')
})

test('版本号规则：每次只加 0.0.1，满 99 才进位', () => {
  assert.equal(nextVersion('1.8.0'), '1.8.1')
  assert.equal(nextVersion('1.8.9'), '1.8.10', '9→10 仍是两位，不进位')
  assert.equal(nextVersion('1.8.98'), '1.8.99')
  assert.equal(nextVersion('1.8.99'), '1.9.0', '第三段满 99 进第二段')
  assert.equal(nextVersion('1.99.99'), '2.0.0', '第二段满 99 进第一段')
  assert.equal(nextVersion('99.99.98'), '99.99.99')
  assert.equal(nextVersion('99.99.99'), null, '封顶，没有下一个')
  assert.equal(nextVersion('1.8.100'), null, '非法入参不猜')
})

test('版本号规则：tag 解析，以及"像版本号但违规"的 tag 不会被静默跳过', () => {
  assert.equal(versionFromTag('v1.8.0'), '1.8.0')
  assert.equal(versionFromTag('1.8.0'), '1.8.0')
  assert.equal(versionFromTag('v1.8.100'), null, '段超两位 → 解析不出')
  assert.equal(versionFromTag('vfoo'), null)
  // 关键区分：解析不出 ≠ 可以忽略。前者要报违规，后者才是无关的非版本 tag。
  assert.equal(looksLikeVersionTag('v1.8.100'), true)
  assert.equal(looksLikeVersionTag('v1.8.0'), true)
  assert.equal(looksLikeVersionTag('release-2026'), false)
  assert.equal(looksLikeVersionTag('v1.8.0-rc1'), false)
})

test('版本号规则：最新版本取数值最大者，不是最后一个', () => {
  assert.equal(latestVersion(['1.8.0', '1.10.0', '1.9.0']), '1.10.0', '按数值比，不按字典序')
  assert.equal(latestVersion(['2.0.0', '1.99.99']), '2.0.0')
  assert.equal(latestVersion(['1.8.0', 'vfoo']), '1.8.0', '非版本号被忽略')
  assert.equal(latestVersion([]), null)
})

test('版本号规则：只允许"等于最新"或"加 0.0.1"，顺手写 1.9.0 要被拒', () => {
  const tags = ['1.6.0', '1.8.0']   // 仓库里的真实形态：没有 v1.7.0
  assert.deepEqual(checkVersionAgainst('1.8.0', tags), { ok: true, latest: '1.8.0', stepped: false })
  assert.deepEqual(checkVersionAgainst('1.8.1', tags), { ok: true, latest: '1.8.0', stepped: true })
  assert.equal(checkVersionAgainst('1.9.0', tags).ok, false, '按语义化版本推出来的 1.9.0 是违规')
  assert.equal(checkVersionAgainst('1.9.0', tags).expected, '1.8.1', '要给出应该写的版本')
  assert.equal(checkVersionAgainst('1.8.2', tags).ok, false, '一次只能 +1')
  assert.equal(checkVersionAgainst('1.8.100', tags).reason, 'format')
  // 满 99 进位的两种放行
  assert.equal(checkVersionAgainst('1.9.0', ['1.8.99']).ok, true)
  assert.equal(checkVersionAgainst('2.0.0', ['1.99.99']).ok, true)
  // 没有可比对的 tag 时只校验格式
  assert.equal(checkVersionAgainst('1.8.0', []).ok, true)
  assert.equal(checkVersionAgainst('1.8.0', []).latest, null)
})

test('版本号规则：本仓库当前版本合规则', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(isValidVersion(pkg.version), true, 'package.json 的 version 必须合规则')
})
