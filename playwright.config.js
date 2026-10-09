import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'**/*.spec.js',workers:1,use:{baseURL:'http://127.0.0.1:5173',headless:true,reducedMotion:'reduce',viewport:{width:1440,height:1100},launchOptions:{channel:'msedge'}},reporter:'list'});
