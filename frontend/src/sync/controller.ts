import { acknowledge, bindSyncAccount, completeSync, keepBothVersions, mergeDownloads, readSyncState, recordSyncFailure, STORAGE_EVENT, STORAGE_SIGNAL } from "../storage/sync";
import { accountRequest } from "../utils/accountApi";
import type { AccountUser } from "../utils/accountApi";
import { isAccountUser, latestOperations, retryDelay } from "./model";
import type { StoredSync, SyncMetadata } from "./model";
import { downloadAllWorkouts, SyncRequestError, uploadOperation } from "./network";
import { DRAFT_EVENT } from "./drafts";

export type SyncView = {
  user: AccountUser | null;
  accountStatus: "checking" | "ready" | "unavailable";
  metadata: SyncMetadata | null;
  pendingCount: number;
  status: "loading" | "off" | "offline" | "signin" | "different-account" | "downloading" | "syncing" | "synced" | "retrying" | "attention" | "editing";
  error: string;
  nextRetryAt: number | null;
  downloadedCount: number;
};
export class SyncController {
  private view: SyncView={user:null,accountStatus:"checking",metadata:null,pendingCount:0,status:"loading",error:"",nextRetryAt:null,downloadedCount:0};
  private listeners=new Set<()=>void>();
  private active=false;
  private running=false;
  private rerun=false;
  private force=false;
  private epoch=0;
  private controller:AbortController|null=null;
  private timer:ReturnType<typeof setTimeout>|undefined;
  getSnapshot=()=>this.view;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  private publish(change:Partial<SyncView>){this.view={...this.view,...change};this.listeners.forEach(listener=>listener());}
  private changed=(event:Event)=>{
    if ((event as CustomEvent<string>).detail && (event as CustomEvent<string>).detail!=="local") return;
    if(this.view.metadata?.owner)this.publish({status:"loading"});this.wake();
  };
  private reconnected=()=>this.wake(true);
  private disconnected=()=>{this.epoch++;this.controller?.abort();this.publish({status:"offline",error:"",nextRetryAt:null});this.wake();};
  private storageChanged=(event:StorageEvent)=>{if(event.key===STORAGE_SIGNAL)this.wake();};
  private visible=()=>{if(document.visibilityState==="visible")this.wake(true);};
  start=()=>{
    this.active=true;
    window.addEventListener(STORAGE_EVENT,this.changed);window.addEventListener(DRAFT_EVENT,this.reconnected);
    window.addEventListener("storage",this.storageChanged);window.addEventListener("online",this.reconnected);
    window.addEventListener("offline",this.disconnected);window.addEventListener("pageshow",this.reconnected);
    document.addEventListener("visibilitychange",this.visible);this.wake(true);
  };
  stop=()=>{
    this.active=false;this.epoch++;this.controller?.abort();clearTimeout(this.timer);
    window.removeEventListener(STORAGE_EVENT,this.changed);window.removeEventListener(DRAFT_EVENT,this.reconnected);
    window.removeEventListener("storage",this.storageChanged);window.removeEventListener("online",this.reconnected);
    window.removeEventListener("offline",this.disconnected);window.removeEventListener("pageshow",this.reconnected);
    document.removeEventListener("visibilitychange",this.visible);
  };
  sessionChanged=(user:AccountUser|null)=>{this.epoch++;this.controller?.abort();this.publish({user,accountStatus:"ready",status:"loading",nextRetryAt:null});this.wake(true);};
  retry=()=>this.wake(true);
  enable=async()=>{
    if(!this.view.user)return;
    try{await bindSyncAccount(this.view.user);this.wake(true);}
    catch(error){this.publish({status:"attention",error:message(error,"Sync could not be enabled. Your workouts are still saved.")});}
  };
  keepBoth=async(id:string)=>{
    if(this.view.user?.id!==this.view.metadata?.owner?.id)return;
    try{await keepBothVersions(this.view.user!.id,id);this.wake(true);}
    catch(error){this.publish({error:message(error,"The versions could not be kept. Your workouts are still saved.")});}
  };
  private wake(force=false){
    if(!this.active)return;this.force ||= force;this.rerun=true;clearTimeout(this.timer);
    if(!this.running)void this.pump();
  }
  private schedule(delay:number){clearTimeout(this.timer);const duration=Math.max(100,delay);this.publish({nextRetryAt:Date.now()+duration});this.timer=setTimeout(()=>this.wake(),duration);}
  private async pump(){
    this.running=true;
    try{while(this.active&&this.rerun){this.rerun=false;const force=this.force;this.force=false;await this.pass(force);}}
    catch(error){if(this.active)this.publish({status:"attention",error:message(error,"Saved sync information could not be read. Your workouts are still saved.")});}
    finally{this.running=false;}
  }
  private showStored(stored:StoredSync){this.publish({metadata:stored.metadata,pendingCount:latestOperations(stored.pending).length});}
  private needsSignIn(){this.publish({user:null,accountStatus:"ready",status:"signin",nextRetryAt:null,error:"Sign back in to the account linked to these workouts. All pending changes were kept."});}
  private async pass(force:boolean){
    const epoch=this.epoch;const valid=()=>this.active&&this.epoch===epoch;
    let stored=await readSyncState();if(!valid())return;this.showStored(stored);
    if(!navigator.onLine){this.publish({status:"offline",error:"",nextRetryAt:null,...(this.view.user?{}:{accountStatus:"unavailable" as const})});return;}
    const controller=new AbortController();this.controller=controller;
    let user:AccountUser|null;
    try{
      const result=await accountRequest("/api/me",undefined,controller.signal);
      if(result?.user&&!isAccountUser(result.user))throw new Error("The signed-in account could not be confirmed.");
      user=result?.user??null;
    }catch{
      if(!valid())return;this.publish({accountStatus:"unavailable",status:stored.metadata.owner?"retrying":"off",error:"Server unavailable. Your changes are saved on this device."});
      if(stored.metadata.owner)this.schedule(10000);return;
    }
    if(!valid())return;this.publish({user,accountStatus:"ready",error:"",nextRetryAt:null});
    if(!stored.metadata.owner){this.publish({status:"off"});return;}
    if(!user){this.publish({status:"signin"});return;}
    if(stored.metadata.owner.id!==user.id){this.publish({status:"different-account"});return;}
    let downloadError="";
    this.publish({status:"downloading",downloadedCount:0});
    try{
      const entries=await downloadAllWorkouts(user.id,controller.signal,count=>{if(valid())this.publish({downloadedCount:count});});
      if(!valid())return;await mergeDownloads(user.id,entries);
    }catch(error){
      if(!valid())return;
      if(error instanceof SyncRequestError&&[401,403].includes(error.status)){this.needsSignIn();return;}
      downloadError="Server workouts could not be downloaded. Existing workouts and pending changes were kept.";
    }
    if(!valid())return;stored=await readSyncState();this.showStored(stored);
    while(valid()){
      const latest=latestOperations(stored.pending).filter(item=>!stored.metadata.conflicts?.[item.workoutId]);
      const operation=latest.find(item=>force||(!item.blocked&&item.nextAttemptAt<=Date.now()));
      if(!operation){
        const conflicts=Object.keys(stored.metadata.conflicts??{}).length;
        if(conflicts){this.publish({status:"attention",error:"A workout changed on another device. Your local copy is kept. Choose Keep both versions to continue.",nextRetryAt:null});return;}
        if(stored.pending.length){
          const retryable=latest.filter(item=>!item.blocked);
          if(retryable.length){this.publish({status:"retrying",error:retryable[0].error});this.schedule(Math.min(...retryable.map(item=>item.nextAttemptAt))-Date.now());}
          else this.publish({status:"attention",error:latest[0]?.error??"Saved changes need attention.",nextRetryAt:null});
          return;
        }
        if(downloadError){this.publish({status:"retrying",error:downloadError});this.schedule(10000);return;}
        if(stored.metadata.deferred?.length){this.publish({status:"editing",error:"Save or cancel your unfinished entry to apply the waiting server update.",nextRetryAt:null});return;}
        const complete=await completeSync(user.id);stored=await readSyncState();if(!valid())return;this.showStored(stored);
        // A save may commit after completeSync's transaction but before this
        // final read. Its fresh queue state must win over the earlier result.
        if(!complete||stored.pending.length||Object.keys(stored.metadata.conflicts??{}).length||stored.metadata.deferred?.length){
          this.publish({status:"loading",error:"",nextRetryAt:null});this.rerun=true;return;
        }
        this.publish({status:"synced",error:"",nextRetryAt:null});return;
      }
      this.publish({status:"syncing",error:downloadError,nextRetryAt:null});
      try{
        const version=await uploadOperation(operation,controller.signal);if(!valid())return;await acknowledge(operation,version);
      }catch(error){
        if(!valid())return;
        if(error instanceof SyncRequestError&&[401,403].includes(error.status)){this.needsSignIn();return;}
        const blocked=error instanceof SyncRequestError&&[400,409,413,422].includes(error.status);
        const text=error instanceof SyncRequestError?error.message:"The server did not confirm this upload. Saved changes will retry automatically.";
        const next=Date.now()+retryDelay(operation.attempts+1);await recordSyncFailure(operation,text,next,blocked);
        stored=await readSyncState();this.showStored(stored);
        if(!blocked){this.publish({status:navigator.onLine?"retrying":"offline",error:text});this.schedule(next-Date.now());return;}
        force=false;continue;
      }
      stored=await readSyncState();if(!valid())return;this.showStored(stored);
    }
  }
}
function message(error:unknown,fallback:string){return error instanceof Error?error.message:fallback;}
