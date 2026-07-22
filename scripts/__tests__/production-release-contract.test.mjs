import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const releaseWorkflow = fs.readFileSync(path.resolve(repoRoot, '.github', 'workflows', 'release.yml'), 'utf8')
const promotionWorkflow = fs.readFileSync(path.resolve(repoRoot, '.github', 'workflows', 'promote-agentic-canvas-os.yml'), 'utf8')
const agentReadySmoke = fs.readFileSync(path.resolve(repoRoot, 'scripts', 'check-agent-ready.mjs'), 'utf8')
const docsSeedScript = fs.readFileSync(path.resolve(repoRoot, 'scripts', 'seed-storage-docs-to-cloudflare.mjs'), 'utf8')
const docsSeedLibrary = fs.readFileSync(path.resolve(repoRoot, 'scripts', 'lib', 'seed-storage-documents-d1.mjs'), 'utf8')
const pagesSyncScript = fs.readFileSync(path.resolve(repoRoot, 'scripts', 'sync-pages-knowgrph.mjs'), 'utf8')
const productionReadinessBuild = fs.readFileSync(path.resolve(repoRoot, 'scripts', 'production-runtime-readiness-build.mjs'), 'utf8')
const pagesDeploymentScript = fs.readFileSync(path.resolve(repoRoot, 'scripts', 'pages-production-deployment.mjs'), 'utf8')
const productionFidelityScript = fs.readFileSync(path.resolve(repoRoot, 'scripts', 'verify-production-fidelity.mjs'), 'utf8')
const productionMirrorArtifactScript = fs.readFileSync(path.resolve(repoRoot, 'scripts', 'production-mirror-artifact.mjs'), 'utf8')
const gameModeSourceAuthorityScript = fs.readFileSync(path.resolve(repoRoot, 'scripts', 'check-game-fps-readiness.mjs'), 'utf8')
const packageScripts = JSON.parse(fs.readFileSync(path.resolve(repoRoot, 'package.json'), 'utf8')).scripts

test('integration forbids alternate standalone Game Mode and XR Physics source owners', () => {
  assert.equal(packageScripts['game-mode:source-authority'], 'node ./scripts/check-game-fps-readiness.mjs')
  assert.match(packageScripts['conflict:source'], /^npm run game-mode:source-authority && /)
  assert.match(gameModeSourceAuthorityScript, /authorityExecutableRoots/)
  assert.match(gameModeSourceAuthorityScript, /deletedStandaloneMarkers/)
  assert.match(gameModeSourceAuthorityScript, /workspaceSeedPaths/)
  assert.match(gameModeSourceAuthorityScript, /declaresStandaloneXrWorld/)
  assert.match(gameModeSourceAuthorityScript, /gameAwareThreeOwners/)
  assert.match(gameModeSourceAuthorityScript, /xrPhysicsThreeOwners/)
  assert.match(gameModeSourceAuthorityScript, /__pbt__\|__tests__\|fixtures\|test\|tests/)
})

test('GitHub workflows pin Node 24 actions to immutable revisions', () => {
  const workflowRoot = path.resolve(repoRoot, '.github', 'workflows')
  const workflowSource = fs.readdirSync(workflowRoot)
    .filter(fileName => fileName.endsWith('.yml') || fileName.endsWith('.yaml'))
    .map(fileName => fs.readFileSync(path.resolve(workflowRoot, fileName), 'utf8'))
    .join('\n')

  const actionUses = [...workflowSource.matchAll(/uses:\s*(actions\/[A-Za-z0-9_.-]+)@([^\s#]+)/g)]
  assert.ok(actionUses.length > 0)
  for (const [, action, revision] of actionUses) {
    assert.match(revision, /^[0-9a-f]{40}$/, `${action} must use an immutable commit SHA`)
  }
  for (const action of ['checkout', 'setup-node', 'setup-python', 'upload-artifact', 'download-artifact']) {
    assert.match(workflowSource, new RegExp(`actions/${action}@[0-9a-f]{40}`))
  }
})

test('production release rebuilds the canvas with the exact authorized candidate revision', () => {
  const verifyJob = releaseWorkflow.slice(
    releaseWorkflow.indexOf('\n  verify:'),
    releaseWorkflow.indexOf('\n  deploy:'),
  )

  assert.match(verifyJob, /name: Build and sync verified candidate/)
  assert.match(verifyJob, /KNOWGRPH_SOURCE_REVISION: \$\{\{ github\.sha \}\}/)
  assert.match(verifyJob, /VITE_KNOWGRPH_STORAGE_BASE_URL: https:\/\/airvio\.co/)
  assert.match(verifyJob, /run: npm run pages:build-sync/)
  assert.doesNotMatch(verifyJob, /run: npm run pages:sync/)
})

test('production release is automatic only for protected main and retains rollback evidence', () => {
  assert.match(releaseWorkflow, /on:\s*\n\s*push:\s*\n\s*branches: \[main\]/)
  assert.doesNotMatch(releaseWorkflow, /workflow_dispatch:/)
  assert.doesNotMatch(releaseWorkflow, /confirmation:/)
  assert.match(releaseWorkflow, /name: Enforce sole deployment ownership/)
  assert.match(releaseWorkflow, /runtime:pages:owner-enforce/)
  assert.match(releaseWorkflow, /name: Capture current production rollback target/)
  assert.match(releaseWorkflow, /runtime:pages:capture-current/)
  assert.match(releaseWorkflow, /name: Capture exact candidate deployment origin/)
  assert.match(releaseWorkflow, /runtime:pages:capture-candidate/)
  assert.match(releaseWorkflow, /runtime:pages:rollback/)
  assert.match(releaseWorkflow, /if: failure\(\) && steps\.deploy_pages\.outcome == 'success'/)
})

test('Agentic Canvas OS docs promote automatically through protected Knowgrph integration', () => {
  assert.match(promotionWorkflow, /schedule:\s*\n\s*- cron:/)
  assert.doesNotMatch(promotionWorkflow, /workflow_dispatch:/)
  assert.match(promotionWorkflow, /secrets\.HUIJOOHWEE_PUSH_TOKEN/)
  assert.match(promotionWorkflow, /gh pr create --draft/)
  assert.match(promotionWorkflow, /gh pr merge "\$url" --auto --squash/)
})

test('production release reconciles competing Cloudflare Pages Git deployment ownership', () => {
  assert.match(pagesDeploymentScript, /enforce-direct-upload-owner/)
  assert.match(pagesDeploymentScript, /method: 'PATCH'/)
  assert.match(pagesDeploymentScript, /production_deployments_enabled: false/)
  assert.match(pagesDeploymentScript, /preview_deployment_setting: 'none'/)
})

test('verified production mirror is published only after live smoke', () => {
  const verifyJob = releaseWorkflow.slice(
    releaseWorkflow.indexOf('\n  verify:'),
    releaseWorkflow.indexOf('\n  deploy:'),
  )
  const deployJob = releaseWorkflow.slice(releaseWorkflow.indexOf('\n  deploy:'))
  const deployIndex = deployJob.indexOf('name: Deploy verified artifact')
  const smokeIndex = deployJob.indexOf('name: Verify live runtime')
  const candidateIndex = deployJob.indexOf('name: Capture exact candidate deployment origin')
  const fidelityIndex = deployJob.indexOf('name: Verify exact deployment markers and public browser fidelity')
  const publishIndex = deployJob.indexOf('name: Publish verified production mirror')

  assert.ok(deployIndex >= 0)
  assert.ok(candidateIndex > deployIndex)
  assert.ok(smokeIndex > deployIndex)
  assert.ok(fidelityIndex > smokeIndex)
  assert.ok(publishIndex > fidelityIndex)
  assert.match(deployJob, /--commit-hash="\$\{\{ github\.sha \}\}"/)
  assert.match(deployJob, /PRODUCTION_ORIGIN: \$\{\{ steps\.candidate\.outputs\.deployment_url \}\}/)
  assert.match(deployJob, /PRODUCTION_PUBLIC_ORIGIN: https:\/\/airvio\.co/)
  assert.match(deployJob, /PRODUCTION_MARKER_ORIGIN: \$\{\{ steps\.candidate\.outputs\.deployment_url \}\}/)
  assert.match(deployJob, /PRODUCTION_BROWSER_HEADLESS: 'false'/)
  assert.match(deployJob, /xvfb-run --auto-servernum npm run production:fidelity:check/)
  assert.match(productionFidelityScript, /scriptsOutsideExactReleaseNamespace/)
  assert.match(productionFidelityScript, /browserAssetScripts\.filter/)
  assert.match(productionFidelityScript, /knowgrph\/assets\/\$\{expectedSourceRevision\}/)
  assert.match(productionFidelityScript, /Physics runtime running with/)
  assert.match(productionFidelityScript, /Beach Ball/)
  assert.match(productionFidelityScript, /page\.frames\(\)\.filter/)
  assert.match(productionFidelityScript, /url\.searchParams\.get\('kgPreview'\) === '1'/)
  assert.match(productionFidelityScript, /evidenceByTarget\.reduce/)
  assert.match(productionFidelityScript, /browserHeadless/)
  assert.match(productionFidelityScript, /heavyRuntimeIntents/)
  assert.match(productionFidelityScript, /bodyTextTail/)
  assert.match(productionFidelityScript, /page\.locator\('body'\)/)
  assert.doesNotMatch(productionFidelityScript, /contentFrame\(\)\.locator\('body'\)/)
  assert.match(productionFidelityScript, /Validation seed fallback/)
  assert.match(productionFidelityScript, /__kgHomeSourceAuthorityEvidence/)
  assert.match(productionFidelityScript, /prematureSceneMounts/)
  assert.match(productionFidelityScript, /waitForHomeSourceAuthority/)
  assert.match(productionFidelityScript, /documentLoadedRootCount/)
  assert.match(productionFidelityScript, /data-kg-xr-document-loaded/)
  assert.match(productionFidelityScript, /data-kg-xr-scene-media-drop/)
  assert.match(productionFidelityScript, /data-kg-xr-empty-world/)
  assert.match(productionFidelityScript, /--use-gl=angle/)
  assert.match(productionFidelityScript, /--use-angle=swiftshader-webgl/)
  assert.match(productionFidelityScript, /--enable-unsafe-swiftshader/)
  assert.match(productionFidelityScript, /Home must retain exactly one canonical XR Canvas/)
  assert.match(productionFidelityScript, /Home must not activate Game Mode before explicit invocation/)
  assert.doesNotMatch(verifyJob, /HUIJOOHWEE_PUSH_TOKEN/)
  assert.match(deployJob, /git push origin HEAD:main/)
  assert.match(deployJob, /HUIJOOHWEE_PUSH_TOKEN/)
})

test('deploy dependency bootstrap retries bounded transient registry failures', () => {
  const deployJob = releaseWorkflow.slice(releaseWorkflow.indexOf('\n  deploy:'))

  assert.match(deployJob, /for attempt in 1 2 3; do/)
  assert.match(deployJob, /if npm ci; then/)
  assert.match(deployJob, /if \[ "\$attempt" -eq 3 \]; then/)
  assert.match(deployJob, /sleep "\$\(\(attempt \* 10\)\)"/)
})

test('generated mirror and rollback are bound to immutable runtime identities', () => {
  assert.match(productionReadinessBuild, /knowgrph-production-runtime-readiness\/v2/)
  assert.match(pagesSyncScript, /runtimeReadinessPaths/)
  assert.match(productionReadinessBuild, /calculateRuntimeArtifactDigest/)
  assert.match(productionReadinessBuild, /calculateImmutableReleaseManifestDigest/)
  assert.match(pagesSyncScript, /sourceRevision/)
  assert.match(pagesDeploymentScript, /deployment_trigger\?\.metadata\?\.commit_hash/)
  assert.match(pagesDeploymentScript, /capture-candidate/)
  assert.match(pagesDeploymentScript, /deployment_url/)
  assert.match(pagesDeploymentScript, /pages\.dev/)
  assert.match(pagesDeploymentScript, /\/rollback`/)
  assert.doesNotMatch(pagesDeploymentScript, /console\.log\([^\n]*(?:apiToken|CLOUDFLARE_API_TOKEN)/)
})

test('production artifact includes the public app-shell mirror fetched by Pages Functions', () => {
  const artifactStep = releaseWorkflow.slice(
    releaseWorkflow.indexOf('name: Upload verified release artifact'),
    releaseWorkflow.indexOf('\n  deploy:'),
  )

  assert.match(artifactStep, /huijoohwee\/content\/knowgrph/)
  assert.match(artifactStep, /huijoohwee\/knowgrph/)
  assert.match(artifactStep, /include-hidden-files: true/)
  assert.match(artifactStep, /\.knowgrph-production-artifact-manifest\.json/)
})

test('deploy reconciles verified additions and deletions into the exact mirror base', () => {
  const deployJob = releaseWorkflow.slice(releaseWorkflow.indexOf('\n  deploy:'))
  const downloadIndex = deployJob.indexOf('name: Download verified artifacts')
  const reconcileIndex = deployJob.indexOf('name: Reconcile verified artifact into exact mirror base')
  const deployIndex = deployJob.indexOf('name: Deploy verified artifact')

  assert.match(releaseWorkflow, /mirror_revision: \$\{\{ steps\.mirror_revision\.outputs\.revision \}\}/)
  assert.match(deployJob, /ref: \$\{\{ needs\.verify\.outputs\.mirror_revision \}\}/)
  assert.match(deployJob, /path: \$\{\{ runner\.temp \}\}\/production-mirror-artifact/)
  assert.match(deployJob, /production:mirror-artifact:reconcile/)
  assert.ok(downloadIndex >= 0)
  assert.ok(reconcileIndex > downloadIndex)
  assert.ok(deployIndex > reconcileIndex)
  assert.match(productionMirrorArtifactScript, /deletedPaths/)
  assert.match(productionMirrorArtifactScript, /Production artifact cannot delete unmanaged path/)
  assert.match(productionMirrorArtifactScript, /readiness markers must be byte-identical/)
})

test('production release reconciles the exact canonical docs revision before live smoke', () => {
  const deployJob = releaseWorkflow.slice(releaseWorkflow.indexOf('\n  deploy:'))
  const checkoutIndex = deployJob.indexOf('Checkout exact Agentic Canvas OS docs SSOT')
  const seedIndex = deployJob.indexOf('Reconcile canonical docs into D1')
  const smokeIndex = deployJob.indexOf('Verify live runtime')

  assert.match(deployJob, /KNOWGRPH_AGENTIC_CANVAS_OS_DOCS_ROOT: \$\{\{ github\.workspace \}\}\/agentic-canvas-os\/docs/)
  assert.match(releaseWorkflow, /docs_repository: \$\{\{ steps\.agentic_canvas_os_docs\.outputs\.repository \}\}/)
  assert.match(deployJob, /repository: \$\{\{ needs\.verify\.outputs\.docs_repository \}\}/)
  assert.match(deployJob, /ref: \$\{\{ needs\.verify\.outputs\.docs_revision \}\}/)
  assert.match(deployJob, /run: npm run storage:d1:seed:docs/)
  assert.ok(checkoutIndex >= 0, 'expected the deploy job to checkout the pinned canonical docs revision')
  assert.ok(seedIndex > checkoutIndex, 'expected D1 reconciliation after the pinned docs checkout')
  assert.ok(smokeIndex > seedIndex, 'expected live smoke after D1 reconciliation')
})

test('agent-ready smoke probes the current canonical docs corpus', () => {
  assert.match(agentReadySmoke, /'agentic-canvas-os',\s+'docs',\s+'RELEASE-WORKFLOW\.md'/m)
  assert.match(agentReadySmoke, /const contentAwareSearchQuery = 'revision-fence'/)
  assert.match(agentReadySmoke, /String\(entry\?\.canonicalPath \|\| ''\) === 'agentic-canvas-os\/docs\/AGENT-DEFINITIONS\.md'/)
  assert.doesNotMatch(agentReadySmoke, /knowgrph-modularity-prd-tad\.md/)
  assert.doesNotMatch(agentReadySmoke, /knowgrph-strybldr-starter-template/)
})

test('canonical docs reconciliation uses the lockfile Wrangler version', () => {
  assert.match(docsSeedScript, /'--no-install',\s+'wrangler',\s+'d1'/m)
  assert.doesNotMatch(docsSeedScript, /wrangler@latest/)
})

test('canonical docs reconciliation proves stored content and exact chunk parity', () => {
  const directSeedIndex = docsSeedScript.indexOf('if (shouldUseDirectD1ControlPlane)')
  const publicExportIndex = docsSeedScript.indexOf("console.log('[knowgrph] export start: before-seed')")
  const directSeedFunction = docsSeedScript.slice(
    docsSeedScript.indexOf('const seedDocumentsDirectlyToD1'),
    docsSeedScript.indexOf('const run = async'),
  )

  assert.match(docsSeedScript, /expectedDocumentSeeds: documentSeeds/)
  assert.match(docsSeedScript, /exportedDocumentChunks: exported\.documentChunks/)
  assert.match(docsSeedScript, /exportWorkspaceDirectlyFromD1/)
  assert.match(docsSeedScript, /graph-snapshots-readback/)
  assert.match(docsSeedScript, /assertNoD1GraphSnapshots\(exported\.graphSnapshots\)/)
  assert.match(docsSeedScript, /buildDirectD1ReconciliationStatements/)
  assert.match(docsSeedScript, /'--command',[\s\S]*'--json'/)
  assert.match(docsSeedScript, /maxBuffer: 64 \* 1024 \* 1024/)
  assert.match(docsSeedScript, /const shouldUseDirectD1ControlPlane = isCanonicalProductionOrigin/)
  assert.match(docsSeedScript, /WHERE workspace_id = .*\n.*AND deleted = 0/)
  assert.match(docsSeedScript, /content-parity=passed/)
  assert.match(docsSeedScript, /snapshots=\$\{snapshotParity\.graphSnapshotCount\}/)
  assert.doesNotMatch(docsSeedScript, /joohwee\.pages\.dev/)
  assert.match(docsSeedLibrary, /documents\.revision >= excluded\.revision/)
  assert.match(docsSeedLibrary, /authoritativeUpdatedAtMs/)
  assert.match(docsSeedLibrary, /DELETE FROM graph_snapshots/)
  assert.match(docsSeedLibrary, /canonical_path NOT IN/)
  assert.match(docsSeedLibrary, /document_id NOT IN/)
  assert.equal(
    (directSeedFunction.match(/executeD1SqlFile\(/g) || []).length,
    1,
    'expected one rollback-safe D1 import for the complete authoritative corpus',
  )
  assert.match(directSeedFunction, /authoritative-corpus-reconciliation/)
  assert.ok(directSeedIndex >= 0, 'expected a direct D1 production branch')
  assert.ok(publicExportIndex > directSeedIndex, 'expected direct production reconciliation before any public storage export')
})
