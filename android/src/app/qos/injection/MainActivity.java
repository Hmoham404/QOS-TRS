package app.qos.injection;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.print.PrintManager;
import android.view.View;
import android.webkit.*;
import android.widget.*;
import org.json.JSONObject;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** Small HTTPS-only client; production logic and shared data stay in the dashboard. */
public final class MainActivity extends Activity {
  private static final String HOME="https://qos-trs.vercel.app/";
  private WebView web;
  private TextView status;
  private ValueCallback<Uri[]> fileCallback;
  private byte[] pendingExport;
  private boolean loadFailed;

  private boolean trusted(String url) {
    if(url==null)return false;
    Uri uri=Uri.parse(url);
    return "https".equals(uri.getScheme()) && "qos-trs.vercel.app".equals(uri.getHost()) && (uri.getPort()==-1||uri.getPort()==443);
  }
  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    LinearLayout root=new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setBackgroundColor(Color.rgb(242,247,251));
    root.setOnApplyWindowInsetsListener((v,insets)->{
      v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
      return insets.consumeSystemWindowInsets();
    });
    status=new TextView(this);
    status.setText("Chargement de QOS…");status.setPadding(24,20,24,20);
    status.setTextColor(Color.rgb(22,53,70));
    status.setOnClickListener(v->web.loadUrl(HOME));root.addView(status);
    web=new WebView(this);root.addView(web,new LinearLayout.LayoutParams(-1,0,1));setContentView(root);
    WebSettings settings=web.getSettings();
    settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);
    settings.setAllowFileAccess(false);settings.setAllowContentAccess(true);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    settings.setUserAgentString(settings.getUserAgentString()+" QOSAndroid/1.0");
    settings.setSupportMultipleWindows(false);
    CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
    web.setWebViewClient(new WebViewClient(){
      @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon){loadFailed=false;}
      @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
        String url=request.getUrl().toString();
        if(trusted(url))return false;
        if(request.isForMainFrame())openBrowser(url);
        return true;
      }
      @Override public void onPageFinished(WebView view,String url){
        if(trusted(url)){
          if(!loadFailed)status.setVisibility(View.GONE);
          view.evaluateJavascript("window.print=function(){window.prompt('QOS_NATIVE:'+JSON.stringify({action:'print'}),'')};",null);
        }
      }
      @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){
        if(request.isForMainFrame()){
          loadFailed=true;
          status.setText("QOS est inaccessible. Vérifiez Internet, puis touchez ici pour réessayer.");status.setVisibility(View.VISIBLE);
        }
      }
    });
    web.setWebChromeClient(new WebChromeClient(){
      @Override public boolean onJsAlert(WebView view,String url,String message,JsResult result){
        new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("OK",(d,w)->result.confirm()).setOnCancelListener(d->result.cancel()).show();return true;
      }
      @Override public boolean onJsConfirm(WebView view,String url,String message,JsResult result){
        new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("Confirmer",(d,w)->result.confirm()).setNegativeButton("Annuler",(d,w)->result.cancel()).setOnCancelListener(d->result.cancel()).show();return true;
      }
      @Override public boolean onJsPrompt(WebView view,String url,String message,String defaultValue,JsPromptResult result){
        if(!trusted(url)||!trusted(view.getUrl())||!message.startsWith("QOS_NATIVE:")){result.cancel();return true;}
        try {
          JSONObject data=new JSONObject(message.substring(11));
          if("save".equals(data.optString("action"))){
            if(pendingExport!=null)throw new IllegalStateException("Terminez l’enregistrement précédent.");
            String content=data.getString("content");
            if(content.length()>10*1024*1024)throw new IllegalArgumentException("Export trop volumineux.");
            pendingExport=content.getBytes(StandardCharsets.UTF_8);
            Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE);
            String mime=data.optString("type","application/octet-stream").split(";")[0];
            intent.setType(mime.contains("/")?mime:"application/octet-stream");
            intent.putExtra(Intent.EXTRA_TITLE,data.optString("name","QOS-export.json").replaceAll("[\\\\/:*?\"<>|]","_"));
            startActivityForResult(intent,102);result.confirm("ok");
          }else if("print".equals(data.optString("action"))){
            ((PrintManager)getSystemService(PRINT_SERVICE)).print("QOS Injection",web.createPrintDocumentAdapter("QOS Injection"),null);result.confirm("ok");
          }else result.cancel();
        }catch(Exception error){pendingExport=null;result.confirm("error");Toast.makeText(MainActivity.this,"Export impossible : "+error.getMessage(),Toast.LENGTH_LONG).show();}
        return true;
      }
      @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
        if(fileCallback!=null)fileCallback.onReceiveValue(null);
        fileCallback=callback;
        try{startActivityForResult(params.createIntent(),101);}catch(Exception error){fileCallback.onReceiveValue(null);fileCallback=null;}
        return true;
      }
    });
    web.setDownloadListener((url,agent,disposition,mime,length)->openBrowser(url));
    if(state==null||web.restoreState(state)==null)web.loadUrl(HOME);
  }
  private void openBrowser(String url){
    Uri uri=Uri.parse(url);
    if(!"https".equals(uri.getScheme()))return;
    try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception error){Toast.makeText(this,"Aucun navigateur disponible.",Toast.LENGTH_LONG).show();}
  }
  @Override protected void onActivityResult(int request,int result,Intent data){
    super.onActivityResult(request,result,data);
    if(request==101&&fileCallback!=null){fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result,data));fileCallback=null;}
    if(request==102){
      if(result==RESULT_OK&&data!=null&&data.getData()!=null&&pendingExport!=null){
        try(OutputStream stream=getContentResolver().openOutputStream(data.getData())){
          if(stream==null)throw new IllegalStateException("Fichier inaccessible");
          stream.write(pendingExport);Toast.makeText(this,"Export enregistré",Toast.LENGTH_SHORT).show();
        }catch(Exception error){Toast.makeText(this,"Impossible d’enregistrer le fichier.",Toast.LENGTH_LONG).show();}
      }
      pendingExport=null;
    }
  }
  @Override protected void onSaveInstanceState(Bundle state){super.onSaveInstanceState(state);web.saveState(state);}
  @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else moveTaskToBack(true);}
  @Override protected void onDestroy(){if(fileCallback!=null)fileCallback.onReceiveValue(null);web.destroy();super.onDestroy();}
}
