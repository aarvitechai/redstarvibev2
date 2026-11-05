// Phase 16: scenario drills. Answer the drill OUT LOUD first (docs/phase-16-interview/02-scenario-drills.md), then
// run it: these are the tests, in all three stacks, that PROVE the answer.
//   npm run drill                 lists the drills
//   npm run drill -- security     runs one (add --only api|react|angular to run a single stack)
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Each stack: which test files, and a regex (React/Angular) or names (.NET) of the tests that prove the point
const DRILLS = {
  'slow-list': {
    question: 'The product list is slow. What do you check, in what order?',
    api: ['ProductList_IsTwoQueries_CountAndOnePage_NoMatterHowManyRows', 'CartPricing_IsOneQuery_ForAnyNumberOfLines', 'Filters_SortAndPage_InSql', 'JsonResponses_AreCompressed_WhenTheClientAcceptsIt'],
    react: { files: ['src/tests/rtkQuery.test.jsx', 'src/tests/phase04Components.test.jsx', 'src/tests/hooks.test.jsx'], filter: 'PREFETCHES|share ONE request|uses the cache|memo \\+ useCallback|debounces' },
    angular: { files: ['src/app/features/directory/directory.spec.ts'], filter: 'debounces|switchMap CANCELS' },
  },
  'stale-table': {
    question: 'An admin edits a product but the table still shows the old value. Why, and how do you fix it?',
    api: ['Update_WithAStaleRowVersion_Is409_AndNothingIsOverwritten', 'StatusChange_WithAStaleRowVersion_Is409'],
    react: { files: ['src/tests/rtkQuery.test.jsx', 'src/tests/admin.test.jsx', 'src/tests/orders.test.jsx'], filter: 'invalidates|table refreshes|tag invalidation|409' },
    angular: { files: ['src/app/features/destinations/destinations.spec.ts', 'src/app/features/admin/admin.spec.ts'], filter: 'bumps the version|refetches|409' },
  },
  security: {
    question: 'Walk me through security end to end: what stops a customer from becoming an admin?',
    api: ['TamperedPayload_PromotingMyselfToAdmin_Is401', 'UnsignedAlgNoneToken_Is401', 'TokenSignedWithAnotherKey_Is401', 'ExpiredToken_Is401', 'AdminEndpoint_Anonymous401_Customer403_Admin200', 'ReusingAnOldRefreshToken_RevokesTheWholeSession', 'Customers_OnlyEverSeeTheirOwnOrders', 'Place_IgnoresEverythingButIdsAndQuantities_NoOverPosting', 'Lockout_AfterFiveWrongPasswords_EvenTheRightPasswordIsRefused'],
    react: { files: ['src/tests/auth.test.jsx'], filter: 'THE LESSON|role-based UI' },
    angular: { files: ['src/app/core/auth/auth.spec.ts'], filter: 'THE LESSON|role-based UI' },
  },
  'admin-url': {
    question: 'A customer types /admin into the address bar. What happens, layer by layer?',
    api: ['OnlyAdmins_Anonymous401_Customer403', 'AdminEndpoint_Anonymous401_Customer403_Admin200'],
    react: { files: ['src/tests/auth.test.jsx', 'src/tests/admin.test.jsx'], filter: '/admin|kept out' },
    angular: { files: ['src/app/core/auth/auth.spec.ts', 'src/app/features/admin/admin.spec.ts'], filter: '/admin|unauthorized' },
  },
  cors: {
    question: 'The browser says "blocked by CORS policy", but Postman works. Explain and fix.',
    api: ['CorsPreflight_OnlyAllowsTheKnownClients', 'Cors_ExposesTheCorrelationHeader_ToBrowserJavaScript', 'A_Wildcard_CorsOrigin_StopsTheApp', 'A_MalformedOrigin_StopsTheApp', 'OutsideDevelopment_PlainHttpOrigins_AreRefused'],
  },
  pagination: {
    question: 'Design paging for a list that grows to a million rows.',
    api: ['SkipTake_AndMetadata', 'Paging_IsStable_AndCoversEveryItemExactlyOnce', 'InvalidPaging_Is400_OnThatField', 'Products_AreNowPaged_WithFiltersAndSort', 'MyOrders_AreNewestFirst_AndPaged'],
    react: { files: ['src/tests/rtkQuery.test.jsx', 'src/tests/routing.test.jsx'], filter: 'PREFETCHES|paged' },
    angular: { files: ['src/app/features/destinations/destinations.spec.ts', 'src/app/features/products/products-paging.spec.ts'], filter: 'page' },
  },
  deployment: {
    question: 'How do you deploy this, and what changes between development and production?',
    api: ['EveryResponse_CarriesTheSecurityHeaders', 'Liveness_ChecksNothing_Readiness_ChecksTheDatabase', 'Production_StartsWithValidSettings_AndHidesTheApiDocs', 'A_MissingConnectionString_StillStopsTheApi', 'BehindTheProxy_EachRealClientGetsItsOwnBucket', 'ByDefault_A_SpoofedForwardedFor_DoesNotBuyAFreshRateLimitBucket', 'OnAFreshDatabase_TheBootstrapAdminCanLogIn_AndReachTheAdminApi', 'AShortSigningKey_StopsTheAppAtStartup'],
    react: { files: ['src/tests/production.test.js'], filter: '.' },
    angular: { files: ['src/app/features/products/image-url.spec.ts'], filter: '.' },
  },
  'out-of-sync': {
    question: 'The UI shows something the server disagrees with. List the ways this app prevents or repairs it.',
    api: ['IgnoresAnyPriceTheClientTriesToSend', 'Snapshot_ARepricedProduct_DoesNotChangeAnExistingOrder', 'OneSaveChanges_IsOneTransaction_AFailingLineSavesNothing'],
    react: { files: ['src/tests/redux.test.jsx', 'src/tests/rtkQuery.test.jsx', 'src/tests/hooks.test.jsx', 'src/tests/refresh.test.jsx'], filter: 'RESETS ON LOGOUT|old server quote|OPTIMISTIC|aborts the previous|SINGLE-FLIGHT' },
    angular: { files: ['src/app/features/cart/cart.spec.ts', 'src/app/features/destinations/destinations.spec.ts', 'src/app/features/directory/directory.spec.ts'], filter: 'RESETS ON LOGOUT|OPTIMISTIC|switchMap CANCELS' },
  },
};

// Run executables DIRECTLY (no shell): the regexes contain | and spaces, which a shell would mangle
const STACKS = {
  api: (names) => ['dotnet', ['test', join(root, 'server/Server.Tests'), '--filter', names.map((n) => `FullyQualifiedName~${n}`).join('|')], root],
  react: ({ files, filter }) => [process.execPath, ['node_modules/vitest/vitest.mjs', 'run', ...files, '-t', filter], join(root, 'client-react')],
  angular: ({ files, filter }) => [process.execPath, ['node_modules/@angular/cli/bin/ng.js', 'test', '--watch=false', ...files.flatMap((f) => ['--include', f]), '--filter', filter], join(root, 'client-angular')],
};

const [name, ...rest] = process.argv.slice(2);
const only = rest[rest.indexOf('--only') + 1];
const drill = DRILLS[name];

if (!drill) {
  console.log(name ? `Unknown drill "${name}".\n` : '');
  console.log('Scenario drills (answer first, then prove it):\n');
  for (const [key, d] of Object.entries(DRILLS)) console.log(`  npm run drill -- ${key.padEnd(12)} ${d.question}`);
  process.exit(name ? 1 : 0);
}

console.log(`\n${drill.question}\n${'-'.repeat(drill.question.length)}`);
let failed = false;
for (const stack of Object.keys(STACKS)) {
  if (!drill[stack] || (rest.includes('--only') && only !== stack)) continue;
  console.log(`\n▶ ${stack}`);
  const [cmd, args, cwd] = STACKS[stack](drill[stack]);
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) failed = true;
}
console.log(failed ? '\n✗ Some proofs failed.' : '\n✓ Every proof passed. Now explain WHY each test exists.');
process.exit(failed ? 1 : 0);
