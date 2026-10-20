// Reproducible native build using the official Android SDK 35 and JDK 21.
// SDK/JDK can be supplied with QOS_ANDROID_TOOLS and QOS_JAVA_HOME.
import {mkdirSync,readFileSync,writeFileSync,copyFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomBytes,createHash} from 'node:crypto';
const root=resolve('.'),tools=resolve(process.env.QOS_ANDROID_TOOLS||'.runtime/android-tools');
const javaHome=process.env.QOS_JAVA_HOME||join(tools,'jdk',readdirSync(join(tools,'jdk'))[0]);
const bin=name=>join(javaHome,'bin',name+'.exe');
const sdk=join(tools,'build-tools','android-15'),platform=join(tools,'platform','android-35','android.jar');
const build=join(root,'.runtime','android-build'),signing=join(root,'.android-signing');
for(const dir of [build,signing,join(build,'res','drawable'),join(build,'classes'),join(build,'dex'),join(root,'public','downloads')])mkdirSync(dir,{recursive:true});
const passwordFile=join(signing,'password.txt'),keystore=join(signing,'qos-release.p12');
if(existsSync(keystore)&&!existsSync(passwordFile))throw Error('Signing password is missing; restore the existing password before building.');
if(!existsSync(passwordFile))writeFileSync(passwordFile,randomBytes(32).toString('base64url'),{mode:0o600});
const password=readFileSync(passwordFile,'utf8').trim();
const env={...process.env,JAVA_HOME:javaHome,QOS_KEY_PASSWORD:password};
function run(file,args){const result=spawnSync(file,args,{cwd:build,env,encoding:'utf8',windowsHide:true});if(result.stdout)process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);if(result.status!==0)throw Error('Android tool failed: '+file+' '+(result.error?.message||result.status));}
if(!existsSync(keystore))run(bin('keytool'),['-genkeypair','-keystore',keystore,'-storetype','PKCS12','-storepass:env','QOS_KEY_PASSWORD','-keypass:env','QOS_KEY_PASSWORD','-alias','qos-release','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=QOS Injection']);
copyFileSync(join(root,'public','icons','icon-192.png'),join(build,'res','drawable','app_icon.png'));
run(join(sdk,'aapt2.exe'),['compile','--dir',join(build,'res'),'-o',join(build,'resources.zip')]);
run(join(sdk,'aapt2.exe'),['link','-o',join(build,'unsigned.apk'),'--manifest',join(root,'android','AndroidManifest.xml'),'-I',platform,join(build,'resources.zip')]);
run(bin('javac'),['--release','8','-encoding','UTF-8','-classpath',platform,'-d',join(build,'classes'),join(root,'android','src','app','qos','injection','MainActivity.java')]);
run(bin('jar'),['cf',join(build,'classes.jar'),'-C',join(build,'classes'),'.']);
run(bin('java'),['-cp',join(sdk,'lib','d8.jar'),'com.android.tools.r8.D8','--release','--min-api','26','--lib',platform,'--output',join(build,'dex'),join(build,'classes.jar')]);
run(bin('jar'),['uf',join(build,'unsigned.apk'),'-C',join(build,'dex'),'classes.dex']);
run(join(sdk,'zipalign.exe'),['-f','-p','4',join(build,'unsigned.apk'),join(build,'aligned.apk')]);
const apk=join(root,'public','downloads','qos-injection.apk');
const signer=['-jar',join(sdk,'lib','apksigner.jar')];
run(bin('java'),[...signer,'sign','--ks',keystore,'--ks-key-alias','qos-release','--ks-pass','env:QOS_KEY_PASSWORD','--key-pass','env:QOS_KEY_PASSWORD','--out',apk,join(build,'aligned.apk')]);
run(bin('java'),[...signer,'verify','--verbose','--print-certs',apk]);
run(join(sdk,'aapt2.exe'),['dump','badging',apk]);
const hash=createHash('sha256').update(readFileSync(apk)).digest('hex');
writeFileSync(join(root,'public','downloads','qos-injection.apk.sha256'),hash+'  qos-injection.apk\n');
console.log('Signed APK: '+apk+'\nSHA-256: '+hash);
