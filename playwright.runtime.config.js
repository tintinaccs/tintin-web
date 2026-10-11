const {defineConfig,devices}=require('@playwright/test');
const path=require('node:path');
const os=require('node:os');
const executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
module.exports=defineConfig({
  outputDir:'artifacts/real-interactions/runtime-tests',
  testDir:'./tests/runtime', fullyParallel:false, workers:1, retries:0,
  timeout:45000, expect:{timeout:10000},
  reporter:[['list'],['html',{outputFolder:process.env.TINTIN_RUNTIME_HTML_DIR || path.join(os.tmpdir(),'tintin-runtime-html-report'),open:'never'}],['json',{outputFile:'artifacts/real-interactions/runtime-results.json'}]],
  use:{baseURL:'http://127.0.0.1:4190',trace:'retain-on-failure',screenshot:'only-on-failure',
    ...(process.env.HTTPS_PROXY ? {proxy:{server:process.env.HTTPS_PROXY,bypass:'127.0.0.1,localhost'}} : {})},
  projects:[
    {name:'chromium-desktop',use:{...devices['Desktop Chrome'],launchOptions:{executablePath,args:['--no-sandbox']}}},
    {name:'chromium-mobile',use:{...devices['Pixel 7'],launchOptions:{executablePath,args:['--no-sandbox']}}},
    {name:'webkit-mobile',use:{...devices['iPhone 13']}},
  ],
  webServer:{command:'node scripts/servidor-flujos-runtime.mjs',url:'http://127.0.0.1:4190/login',reuseExistingServer:false,timeout:30000},
});
