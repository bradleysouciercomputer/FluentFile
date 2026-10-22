import React, { useEffect, useRef, useState } from "react";
import {
  FluentProvider, webLightTheme, webDarkTheme, makeStyles, tokens,
  Button, Input, SearchBox, Text, Title2, Title3, Body1, Caption1,
  Card, TabList, Tab, Toolbar, ToolbarButton, Badge, Tooltip, Spinner,
  MessageBar, MessageBarBody, Dialog, DialogSurface, DialogBody,
  DialogTitle, DialogContent, DialogActions, Field, Dropdown, Option,
  Switch, Menu, MenuTrigger, MenuPopover, MenuList, MenuItem, ProgressBar
} from "@fluentui/react-components";
import {
  Folder24Regular, FolderOpen24Regular, Home24Regular, Clock24Regular,
  Star24Regular, Delete24Regular, ArrowUpload24Regular, ArrowDownload24Regular,
  MoreHorizontal24Regular, Grid24Regular, AppsList24Regular, Document24Regular,
  Image24Regular, VideoClip24Regular, MusicNote2_24Regular, ArrowUndo24Regular,
  Rename24Regular, Dismiss24Regular, ShieldCheckmark24Regular, FolderAdd24Regular,
  ChevronRight12Regular, ArrowMove24Regular, DocumentPdf24Regular, Attach24Regular,
  Open24Regular
} from "@fluentui/react-icons";

const DB = "fluentfile-browser-store";
function openDB() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) return reject(new Error("IndexedDB is unavailable in this browser."));
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("files")) db.createObjectStore("files", { keyPath: "id" });
      if (!db.objectStoreNames.contains("folders")) db.createObjectStore("folders", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open browser storage."));
  });
}
async function getAll(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, "readonly").objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
async function write(store, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Storage write was cancelled."));
  });
}
async function remove(store, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
const uid = () => crypto.randomUUID ? crypto.randomUUID() : "ff-" + Date.now() + "-" + Math.random().toString(36).slice(2);
const ext = name => (name || "").includes(".") ? name.split(".").pop().toLowerCase() : "";
const size = n => {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"], i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), 4);
  return (n / Math.pow(1024, i)).toLocaleString(undefined, { maximumFractionDigits: i ? 1 : 0 }) + " " + units[i];
};
const date = n => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: new Date(n).getFullYear() === new Date().getFullYear() ? undefined : "numeric" }).format(new Date(n));
const isDeleted = file => !!file.deletedAt;
const kind = file => {
  const e = ext(file.name), t = (file.type || "").toLowerCase();
  if (t.startsWith("image/") || ["png","jpg","jpeg","gif","webp","svg","bmp","avif"].includes(e)) return "image";
  if (t.startsWith("video/") || ["mp4","webm","mov","m4v"].includes(e)) return "video";
  if (t.startsWith("audio/") || ["mp3","wav","ogg","m4a","flac"].includes(e)) return "audio";
  if (t === "application/pdf" || e === "pdf") return "pdf";
  if (t.startsWith("text/") || ["txt","md","csv","json","log","xml","yaml","yml","js","css","html"].includes(e)) return "text";
  return "file";
};
const iconFor = file => {
  switch (kind(file)) {
    case "image": return <Image24Regular />;
    case "video": return <VideoClip24Regular />;
    case "audio": return <MusicNote2_24Regular />;
    case "pdf": return <DocumentPdf24Regular />;
    case "file": return <Attach24Regular />;
    default: return <Document24Regular />;
  }
};
const mimeFor = name => ({txt:"text/plain",md:"text/markdown",csv:"text/csv",json:"application/json",xml:"application/xml",html:"text/html",htm:"text/html",css:"text/css",js:"text/javascript",pdf:"application/pdf",svg:"image/svg+xml"})[ext(name)] || "application/octet-stream";

const useStyles = makeStyles({
  app:{minHeight:"100vh",display:"grid",gridTemplateColumns:"250px minmax(0,1fr)",backgroundColor:tokens.colorNeutralBackground2,color:tokens.colorNeutralForeground1},
  sidebar:{minHeight:"100vh",display:"flex",flexDirection:"column",padding:"20px 12px 14px",backgroundColor:tokens.colorNeutralBackground1,borderRight:"1px solid "+tokens.colorNeutralStroke2,gap:"22px"},
  brand:{display:"flex",gap:"10px",alignItems:"center",padding:"4px 10px 8px"},
  brandMark:{width:"36px",height:"36px",display:"grid",placeItems:"center",borderRadius:tokens.borderRadiusMedium,color:tokens.colorBrandForeground1,backgroundColor:tokens.colorBrandBackground2,flexShrink:0},
  navLabel:{padding:"0 12px 6px",color:tokens.colorNeutralForeground3,fontSize:tokens.fontSizeBase100,fontWeight:tokens.fontWeightSemibold,letterSpacing:"0.06em",textTransform:"uppercase"},
  nav:{display:"flex",flexDirection:"column",gap:"4px"},
  navButton:{justifyContent:"flex-start",width:"100%",minWidth:0,height:"38px"},
  navActive:{backgroundColor:tokens.colorNeutralBackground1Selected,color:tokens.colorBrandForeground1},
  storage:{marginTop:"auto",padding:"14px 12px 2px",borderTop:"1px solid "+tokens.colorNeutralStroke2,display:"grid",gap:"8px"},
  main:{minWidth:0},
  topbar:{minHeight:"68px",position:"sticky",top:0,zIndex:4,display:"flex",alignItems:"center",gap:"12px",padding:"12px 30px",backgroundColor:tokens.colorNeutralBackground1,borderBottom:"1px solid "+tokens.colorNeutralStroke2},
  search:{width:"min(100%, 560px)"},
  topRight:{marginLeft:"auto",display:"flex",alignItems:"center",gap:"8px"},
  privacy:{display:"flex",alignItems:"center",gap:"6px",whiteSpace:"nowrap",color:tokens.colorNeutralForeground2},
  page:{padding:"28px 30px 36px",maxWidth:"1600px",margin:"0 auto"},
  pageHead:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"18px",marginBottom:"20px"},
  titleBlock:{display:"grid",gap:"5px"},
  actions:{display:"flex",alignItems:"center",flexWrap:"wrap",gap:"8px"},
  dropzone:{border:"1px dashed "+tokens.colorNeutralStroke1,borderRadius:tokens.borderRadiusLarge,backgroundColor:tokens.colorNeutralBackground1,display:"flex",alignItems:"center",gap:"12px",padding:"12px 16px",marginBottom:"20px"},
  dropDrag:{backgroundColor:tokens.colorBrandBackground2,borderColor:tokens.colorBrandStroke1},
  dropMark:{width:"38px",height:"38px",flexShrink:0,display:"grid",placeItems:"center",borderRadius:tokens.borderRadiusMedium,backgroundColor:tokens.colorBrandBackground2,color:tokens.colorBrandForeground1},
  dropCopy:{flex:1,minWidth:0,display:"flex",flexWrap:"wrap",alignItems:"baseline",gap:"4px"},
  breadcrumbs:{display:"flex",alignItems:"center",flexWrap:"wrap",gap:"4px",marginBottom:"14px"},
  contentBar:{display:"flex",alignItems:"center",gap:"12px",flexWrap:"wrap",paddingBottom:"10px",marginBottom:"14px",borderBottom:"1px solid "+tokens.colorNeutralStroke2},
  controls:{marginLeft:"auto",display:"flex",alignItems:"center",gap:"8px"},
  sections:{display:"grid",gap:"20px"},
  section:{display:"grid",gap:"10px"},
  sectionTitle:{margin:0},
  folderGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(min(220px, 100%), 1fr))",gap:"10px"},
  folderCard:{padding:"12px",display:"flex",alignItems:"center",minWidth:0,gap:"10px",":hover":{borderColor:tokens.colorNeutralStroke1Hover}},
  folderMark:{width:"38px",height:"38px",display:"grid",placeItems:"center",flexShrink:0,borderRadius:tokens.borderRadiusMedium,backgroundColor:tokens.colorBrandBackground2,color:tokens.colorBrandForeground1},
  itemInfo:{flex:1,minWidth:0,display:"grid",gap:"3px"},
  itemName:{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},
  fileGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(min(210px, 100%), 1fr))",gap:"10px"},
  fileGridList:{display:"flex",flexDirection:"column",gap:"6px"},
  fileCard:{minWidth:0,overflow:"hidden",display:"flex",flexDirection:"column"},
  fileCardList:{flexDirection:"row",alignItems:"center"},
  filePreview:{width:"100%",height:"112px",flexShrink:0,display:"grid",placeItems:"center",overflow:"hidden",cursor:"pointer",backgroundColor:tokens.colorNeutralBackground3,borderBottom:"1px solid "+tokens.colorNeutralStroke2,color:tokens.colorBrandForeground1},
  filePreviewList:{width:"58px",height:"58px",backgroundColor:"transparent",borderBottom:0},
  thumbnail:{width:"100%",height:"100%",objectFit:"cover"},
  fileBody:{minWidth:0,flex:1,padding:"10px 12px",display:"grid",gap:"5px"},
  fileNameRow:{display:"flex",minWidth:0,alignItems:"center",gap:"6px"},
  fileMeta:{display:"flex",alignItems:"center",flexWrap:"wrap",gap:"10px",color:tokens.colorNeutralForeground3},
  fileActions:{display:"flex",alignItems:"center",gap:"2px",padding:"4px 7px",borderTop:"1px solid "+tokens.colorNeutralStroke2},
  fileActionsList:{borderTop:0,marginLeft:"auto"},
  flexGap:{flex:1},
  empty:{minHeight:"270px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",gap:"12px",padding:"36px 16px"},
  emptyMark:{width:"62px",height:"62px",display:"grid",placeItems:"center",borderRadius:tokens.borderRadiusXLarge,backgroundColor:tokens.colorBrandBackground2,color:tokens.colorBrandForeground1},
  bottomNote:{display:"flex",justifyContent:"center",alignItems:"center",gap:"6px",paddingTop:"26px",color:tokens.colorNeutralForeground3},
  preview:{minHeight:"250px",maxHeight:"65vh",overflow:"auto",display:"grid",placeItems:"center",backgroundColor:tokens.colorNeutralBackground3,borderRadius:tokens.borderRadiusMedium},
  previewImage:{maxWidth:"100%",maxHeight:"62vh",objectFit:"contain"},
  previewVideo:{maxWidth:"100%",maxHeight:"62vh"},
  previewText:{margin:0,width:"100%",textAlign:"left",padding:"16px",whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontFamily:"Consolas,monospace",fontSize:"12px",lineHeight:"1.55"},
  toast:{position:"fixed",right:"20px",bottom:"20px",zIndex:1000,display:"flex",alignItems:"center",gap:"12px",maxWidth:"min(440px, calc(100vw - 40px))",padding:"8px 10px 8px 16px",backgroundColor:tokens.colorNeutralBackground1,border:"1px solid "+tokens.colorNeutralStroke1,borderRadius:tokens.borderRadiusLarge,boxShadow:tokens.shadow16}
});

function FileCard({file,layout,styles,onAction,onPreview}) {
  const [imageUrl,setImageUrl] = useState("");
  useEffect(() => {
    if (kind(file) !== "image") return;
    const url = URL.createObjectURL(file.blob);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file.id,file.blob]);
  return <Card className={layout === "list" ? styles.fileCard+" "+styles.fileCardList : styles.fileCard}>
    <div className={(layout === "list" ? styles.filePreview+" "+styles.filePreviewList+" ff-file-preview ff-file-preview-list" : styles.filePreview+" ff-file-preview") } role="button" tabIndex={0} aria-label={"Preview "+file.name} onClick={() => onPreview(file)} onKeyDown={e => {if(e.key==="Enter")onPreview(file);}}>
      {imageUrl ? <img className={styles.thumbnail} src={imageUrl} alt="" /> : React.cloneElement(iconFor(file),{fontSize:32})}
    </div>
    <div className={styles.fileBody}>
      <div className={styles.fileNameRow}><Text weight="semibold" className={styles.itemName} title={file.name}>{file.name}</Text>{file.favorite && !isDeleted(file) && <Star24Regular color="#C19C00" />}</div>
      <div className={styles.fileMeta}><Caption1>{size(file.size)}</Caption1><Caption1>{date(file.modifiedAt)}</Caption1></div>
    </div>
    <div className={layout === "list" ? styles.fileActions+" "+styles.fileActionsList : styles.fileActions}>
      {isDeleted(file) ? <>
        <Tooltip content="Restore" relationship="label"><Button appearance="subtle" icon={<ArrowUndo24Regular/>} aria-label="Restore" onClick={() => onAction("restore",file)}/></Tooltip>
        <Tooltip content="Delete permanently" relationship="label"><Button appearance="subtle" icon={<Delete24Regular/>} aria-label="Delete permanently" onClick={() => onAction("delete",file)}/></Tooltip>
      </> : <>
        <Tooltip content={file.favorite?"Remove favorite":"Add favorite"} relationship="label"><Button appearance="subtle" icon={<Star24Regular/>} aria-label="Toggle favorite" onClick={() => onAction("favorite",file)}/></Tooltip>
        <Tooltip content="Download" relationship="label"><Button appearance="subtle" icon={<ArrowDownload24Regular/>} aria-label="Download" onClick={() => onAction("download",file)}/></Tooltip>
        <Tooltip content="Move to folder" relationship="label"><Button appearance="subtle" icon={<ArrowMove24Regular/>} aria-label="Move" onClick={() => onAction("move",file)}/></Tooltip>
        <span className={styles.flexGap}/>
        <Menu><MenuTrigger disableButtonEnhancement><Button appearance="subtle" icon={<MoreHorizontal24Regular/>} aria-label={"More options for "+file.name}/></MenuTrigger>
          <MenuPopover><MenuList>
            <MenuItem icon={<Open24Regular/>} onClick={() => onPreview(file)}>Preview</MenuItem>
            <MenuItem icon={<Rename24Regular/>} onClick={() => onAction("rename",file)}>Rename</MenuItem>
            <MenuItem icon={<Delete24Regular/>} onClick={() => onAction("trash",file)}>Move to recycle bin</MenuItem>
          </MenuList></MenuPopover>
        </Menu>
      </>}
    </div>
  </Card>;
}

function App() {
  const s = useStyles();
  const [files,setFiles] = useState([]);
  const [folders,setFolders] = useState([]);
  const [view,setView] = useState("files");
  const [folderId,setFolderId] = useState(null);
  const [query,setQuery] = useState("");
  const [sortBy,setSortBy] = useState("modified");
  const [layout,setLayout] = useState("grid");
  const [dark,setDark] = useState(false);
  const [loading,setLoading] = useState(true);
  const [storageError,setStorageError] = useState("");
  const [storageEstimate,setStorageEstimate] = useState(null);
  const [dragging,setDragging] = useState(false);
  const [dialog,setDialog] = useState(null);
  const [dialogTarget,setDialogTarget] = useState(null);
  const [dialogName,setDialogName] = useState("");
  const [moveTarget,setMoveTarget] = useState("root");
  const [previewFile,setPreviewFile] = useState(null);
  const [previewUrl,setPreviewUrl] = useState("");
  const [previewText,setPreviewText] = useState("");
  const [notice,setNotice] = useState("");
  const inputRef = useRef(null);
  const restoreRef = useRef(null);
  const toastTimer = useRef(null);

  const refresh = async () => {
    try {
      const [f,d] = await Promise.all([getAll("files"),getAll("folders")]);
      setFiles(f);setFolders(d);setStorageError("");
      if(navigator.storage?.estimate) setStorageEstimate(await navigator.storage.estimate());
      if(navigator.storage?.persist) navigator.storage.persist().catch(()=>{});
    } catch(error) { setStorageError(error.message||"Browser storage could not be opened."); }
    finally { setLoading(false); }
  };
  useEffect(()=>{refresh();},[]);
  useEffect(()=>()=>clearTimeout(toastTimer.current),[]);
  const toast = message => {setNotice(message);clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setNotice(""),3500);};
  const getFolder = id => folders.find(f=>f.id===id)||null;
  const folderLabel = id => getFolder(id)?.name || "My files";
  const liveFiles = files.filter(f=>!isDeleted(f));
  const trashFiles = files.filter(isDeleted);
  const favCount = liveFiles.filter(f=>f.favorite).length;
  const usedBytes = liveFiles.reduce((n,f)=>n+(f.size||0),0);
  const quotaPercent = storageEstimate?.quota ? Math.min(1,usedBytes/storageEstimate.quota) : 0;

  let folderPath=[],cursor=getFolder(folderId),seen=new Set();
  while(cursor&&!seen.has(cursor.id)){folderPath.unshift(cursor);seen.add(cursor.id);cursor=cursor.parentId?getFolder(cursor.parentId):null;}
  const q=query.trim().toLocaleLowerCase();
  let shownFolders=view==="files" ? folders.filter(f=>q?f.name.toLocaleLowerCase().includes(q):f.parentId===folderId) : [];
  shownFolders=shownFolders.sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:"base"}));
  let shownFiles=files.filter(f=>{
    if(view==="trash")return isDeleted(f);
    if(isDeleted(f))return false;
    if(view==="favorites"&&!f.favorite)return false;
    if(view==="files"&&!q&&f.folderId!==folderId)return false;
    return true;
  });
  if(q)shownFiles=shownFiles.filter(f=>f.name.toLocaleLowerCase().includes(q));
  if(sortBy==="name")shownFiles.sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:"base"}));
  else if(sortBy==="size")shownFiles.sort((a,b)=>b.size-a.size);
  else shownFiles.sort((a,b)=>b.modifiedAt-a.modifiedAt);
  if(view==="recent")shownFiles=shownFiles.slice(0,50);

  const goView = name => {setView(name);setFolderId(null);setQuery("");};
  const openEditor = (type,target=null) => {setDialog(type);setDialogTarget(target);setDialogName(target?.name||"");setMoveTarget("root");};
  const closeDialog = () => {setDialog(null);setDialogTarget(null);setDialogName("");};
  const createFolder = async () => {
    if(!dialogName.trim())return;
    try {await write("folders",{id:uid(),name:dialogName.trim(),parentId:folderId,createdAt:Date.now()});closeDialog();await refresh();toast("Folder created.");}
    catch(e){toast(e.message||"Could not create folder.");}
  };
  const rename = async () => {
    if(!dialogTarget||!dialogName.trim())return;
    const store=dialog==="rename-folder"?"folders":"files";
    try{await write(store,{...dialogTarget,name:dialogName.trim(),...(store==="files"?{modifiedAt:Date.now()}:{})});closeDialog();await refresh();toast("Renamed successfully.");}
    catch(e){toast(e.message||"Could not rename item.");}
  };
  const addFiles = async list => {
    const incoming=Array.from(list||[]);if(!incoming.length)return;
    if(view!=="files"){setView("files");setFolderId(null);}
    try {
      for(const file of incoming)await write("files",{id:uid(),name:file.name,type:file.type||mimeFor(file.name),size:file.size,modifiedAt:file.lastModified||Date.now(),createdAt:Date.now(),folderId,blob:file,favorite:false,deletedAt:null});
      await refresh();toast("Saved "+incoming.length+" file"+(incoming.length===1?"":"s")+" to this browser.");
    } catch(e){toast("Could not save files. "+(e.message||"Check browser storage quota."));await refresh();}
  };
  const download = file => {
    const url=URL.createObjectURL(file.blob),a=document.createElement("a");
    a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
  };
  const preview = async file => {
    if(previewUrl)URL.revokeObjectURL(previewUrl);
    const url=URL.createObjectURL(file.blob);setPreviewUrl(url);setPreviewFile(file);setPreviewText("");
    if(kind(file)==="text"){
      try{setPreviewText(file.size>1000000?"This file is too large to preview here. Download it to read the contents.":await file.blob.text());}
      catch{setPreviewText("Could not read this preview.");}
    }
    setDialog("preview");
  };
  const closePreview = () => {if(previewUrl)URL.revokeObjectURL(previewUrl);setPreviewUrl("");setPreviewFile(null);setPreviewText("");setDialog(null);};
  const action = async (name,file) => {
    try {
      if(name==="favorite"){await write("files",{...file,favorite:!file.favorite});await refresh();if(previewFile?.id===file.id)setPreviewFile({...file,favorite:!file.favorite});toast(file.favorite?"Removed from favorites.":"Added to favorites.");}
      if(name==="download")download(file);
      if(name==="preview")preview(file);
      if(name==="trash"){await write("files",{...file,deletedAt:Date.now()});await refresh();toast("Moved to recycle bin.");}
      if(name==="restore"){await write("files",{...file,deletedAt:null});await refresh();toast("File restored.");}
      if(name==="delete"&&window.confirm('Permanently delete "'+file.name+'"? This cannot be undone.')){await remove("files",file.id);await refresh();toast("File permanently deleted.");}
      if(name==="rename")openEditor("rename-file",file);
      if(name==="move")openEditor("move",file);
    } catch(e){toast(e.message||"The action could not be completed.");}
  };
  const backup = async () => {
    try {
      const JSZip=(await import("jszip")).default,zip=new JSZip(),root=zip.folder("FluentFile backup");
      const pathFor = id => {const parts=[],pathSeen=new Set();let f=id?getFolder(id):null;while(f&&!pathSeen.has(f.id)){parts.unshift(f.name);pathSeen.add(f.id);f=f.parentId?getFolder(f.parentId):null;}return parts;};
      liveFiles.forEach(f=>root.file(pathFor(f.folderId).concat(f.name).join("/"),f.blob));
      root.file("_fluentfile-manifest.json",JSON.stringify({version:1,folders,createdAt:new Date().toISOString()},null,2));
      const blob=await zip.generateAsync({type:"blob"}),url=URL.createObjectURL(blob),a=document.createElement("a");
      a.href=url;a.download="FluentFile-backup.zip";a.click();setTimeout(()=>URL.revokeObjectURL(url),1200);toast("ZIP backup created.");
    } catch(e){toast("Could not create backup. "+(e.message||"Try again."));}
  };
  const restoreZip = async zipFile => {
    try {
      const JSZip=(await import("jszip")).default,zip=await JSZip.loadAsync(zipFile);
      const entries=Object.keys(zip.files).filter(key=>!zip.files[key].dir&&!key.endsWith("_fluentfile-manifest.json"));let count=0;
      for(const key of entries){
        const item=zip.files[key],blob=await item.async("blob"),name=key.split("/").pop();if(!name)continue;
        const parts=key.split("/").slice(1,-1);let parentId=null;
        for(const part of parts){let all=await getAll("folders"),folder=all.find(f=>f.parentId===parentId&&f.name===part);
          if(!folder){folder={id:uid(),name:part,parentId,createdAt:Date.now()};await write("folders",folder);}parentId=folder.id;
        }
        await write("files",{id:uid(),name,type:mimeFor(name),size:blob.size,modifiedAt:Date.now(),createdAt:Date.now(),folderId:parentId,blob,favorite:false,deletedAt:null});count++;
      }
      await refresh();toast("Restored "+count+" file"+(count===1?"":"s")+" from backup.");
    } catch(e){toast("Could not restore this ZIP backup. "+(e.message||""));}
  };
  const fileCard = f => <FileCard key={f.id} file={f} layout={layout} styles={s} onAction={action} onPreview={preview}/>;
  const title = view==="trash"?"Recycle bin":view==="favorites"?"Favorites":view==="recent"?"Recent":folderLabel(folderId);
  const subtitle = view==="trash"?"Restore deleted files or permanently remove them.":view==="favorites"?"Your starred files in one place.":view==="recent"?"Your most recently changed files.":"Organize files and folders stored in this browser.";

  return <FluentProvider theme={dark?webDarkTheme:webLightTheme}>
    <div className={s.app+" ff-app"}>
      <aside className={s.sidebar+" ff-sidebar"} aria-label="Main navigation">
        <div className={s.brand+" ff-brand"}>
          <div className={s.brandMark}><FolderOpen24Regular fontSize={24}/></div>
          <div className="ff-brand-text"><Text weight="semibold" size={500}>FluentFile</Text><div><Caption1>Personal file space</Caption1></div></div>
        </div>
        <section><Text className={s.navLabel+" ff-nav-label"}>Workspace</Text><nav className={s.nav+" ff-nav"}>
          <Button className={s.navButton+" ff-nav-button "+(view==="files"?s.navActive:"")} appearance="subtle" icon={<Home24Regular/>} onClick={()=>goView("files")}><span className="ff-nav-text">My files</span></Button>
          <Button className={s.navButton+" ff-nav-button "+(view==="recent"?s.navActive:"")} appearance="subtle" icon={<Clock24Regular/>} onClick={()=>goView("recent")}><span className="ff-nav-text">Recent</span></Button>
          <Button className={s.navButton+" ff-nav-button "+(view==="favorites"?s.navActive:"")} appearance="subtle" icon={<Star24Regular/>} onClick={()=>goView("favorites")}><span className="ff-nav-text">Favorites</span>{favCount>0&&<Badge size="small">{favCount}</Badge>}</Button>
          <Button className={s.navButton+" ff-nav-button "+(view==="trash"?s.navActive:"")} appearance="subtle" icon={<Delete24Regular/>} onClick={()=>goView("trash")}><span className="ff-nav-text">Recycle bin</span>{trashFiles.length>0&&<Badge size="small">{trashFiles.length}</Badge>}</Button>
        </nav></section>
        <section className={s.storage+" ff-storage"}>
          <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}><Text weight="semibold" size={200}>Browser storage</Text><Caption1>{size(usedBytes)}</Caption1></div>
          <ProgressBar value={quotaPercent} thickness="medium"/>
          <Caption1>{storageEstimate?.quota?"Quota estimate: "+size(storageEstimate.quota):"Saved on this device; not uploaded to a server."}</Caption1>
          <Switch checked={dark} onChange={(_,data)=>setDark(data.checked)} label="Dark mode"/>
        </section>
      </aside>
      <main className={s.main}>
        <header className={s.topbar+" ff-topbar"}>
          <SearchBox className={s.search} placeholder="Search files and folders" value={query} onChange={(_,data)=>setQuery(data.value)}/>
          <div className={s.topRight}>
            <Text className={s.privacy}><ShieldCheckmark24Regular/><span className="ff-privacy-text">Stored locally</span></Text>
            <Button appearance="secondary" icon={<ArrowDownload24Regular/>} onClick={backup}>Backup</Button>
            <Button appearance="secondary" icon={<ArrowUndo24Regular/>} onClick={()=>restoreRef.current?.click()}>Restore</Button>
            <input ref={restoreRef} type="file" accept=".zip,application/zip" hidden onChange={e=>{if(e.target.files?.[0])restoreZip(e.target.files[0]);e.target.value="";}}/>
          </div>
        </header>
        <div className={s.page+" ff-page"}>
          {storageError&&<MessageBar intent="error"><MessageBarBody><strong>Browser storage is unavailable. </strong>{storageError} Check your browser's site storage settings and reload.</MessageBarBody></MessageBar>}
          <div className={s.pageHead}>
            <div className={s.titleBlock}><Caption1>WORKSPACE / {view==="files"?"MY FILES":view.toUpperCase()}</Caption1><Title2>{title}</Title2><Body1>{subtitle}</Body1></div>
            {view==="files"&&<div className={s.actions}><Button appearance="secondary" icon={<FolderAdd24Regular/>} onClick={()=>openEditor("new-folder")}>New folder</Button><Button appearance="primary" icon={<ArrowUpload24Regular/>} onClick={()=>inputRef.current?.click()}>Upload files</Button><input ref={inputRef} type="file" multiple hidden onChange={e=>{addFiles(e.target.files);e.target.value="";}}/></div>}
          </div>
          {view==="files"&&<div className={s.dropzone+" "+(dragging?s.dropDrag:"")} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);addFiles(e.dataTransfer.files);}}>
            <div className={s.dropMark}><ArrowUpload24Regular fontSize={22}/></div><div className={s.dropCopy+" ff-drop-copy"}><Text weight="semibold">Drop files here</Text><Caption1>or use Upload files. Everything stays in this browser.</Caption1></div><Button appearance="subtle" onClick={()=>inputRef.current?.click()}>Browse files</Button>
          </div>}
          {view==="files"&&<div className={s.breadcrumbs}><Button size="small" appearance="subtle" onClick={()=>{setFolderId(null);setQuery("");}}>My files</Button>{folderPath.map(f=><React.Fragment key={f.id}><ChevronRight12Regular/><Button size="small" appearance="subtle" onClick={()=>{setFolderId(f.id);setQuery("");}}>{f.name}</Button></React.Fragment>)}</div>}
          <div className={s.contentBar}><Text size={200}>{shownFolders.length} folder{shownFolders.length===1?"":"s"} · {shownFiles.length} file{shownFiles.length===1?"":"s"}</Text><div className={s.controls}>
            <Dropdown size="small" value={sortBy==="modified"?"Last modified":sortBy==="name"?"Name":"Size"} selectedOptions={[sortBy]} onOptionSelect={(_,data)=>setSortBy(data.optionValue||"modified")} aria-label="Sort files"><Option value="modified">Last modified</Option><Option value="name">Name</Option><Option value="size">Size</Option></Dropdown>
            <Toolbar aria-label="Display options"><ToolbarButton title="Grid view" aria-label="Grid view" icon={<Grid24Regular/>} appearance={layout==="grid"?"primary":"subtle"} onClick={()=>setLayout("grid")}/><ToolbarButton title="List view" aria-label="List view" icon={<AppsList24Regular/>} appearance={layout==="list"?"primary":"subtle"} onClick={()=>setLayout("list")}/></Toolbar>
          </div></div>
          {loading?<div className={s.empty}><Spinner label="Loading your files…"/></div>:<>
            <div className={s.sections}>
              {shownFolders.length>0&&<section className={s.section}><Title3 className={s.sectionTitle}>Folders</Title3><div className={s.folderGrid}>{shownFolders.map(folder=><Card key={folder.id} className={s.folderCard}>
                <div className={s.folderMark}><Folder24Regular fontSize={24}/></div><Button appearance="subtle" className={s.itemInfo} onClick={()=>{setFolderId(folder.id);setQuery("");}}><Text weight="semibold" className={s.itemName}>{folder.name}</Text><Caption1>Folder</Caption1></Button>
                <Menu><MenuTrigger disableButtonEnhancement><Button appearance="subtle" icon={<MoreHorizontal24Regular/>} aria-label={"Options for "+folder.name}/></MenuTrigger><MenuPopover><MenuList><MenuItem icon={<FolderOpen24Regular/>} onClick={()=>{setFolderId(folder.id);setQuery("");}}>Open</MenuItem><MenuItem icon={<Rename24Regular/>} onClick={()=>openEditor("rename-folder",folder)}>Rename</MenuItem></MenuList></MenuPopover></Menu>
              </Card>)}</div></section>}
              {shownFiles.length>0&&<section className={s.section}><Title3 className={s.sectionTitle}>{view==="trash"?"Deleted files":shownFolders.length?"Files":"All files"}</Title3><div className={(layout==="list"?s.fileGrid+" "+s.fileGridList:s.fileGrid)+" ff-file-grid"}>{shownFiles.map(fileCard)}</div></section>}
            </div>
            {!shownFolders.length&&!shownFiles.length&&<div className={s.empty}><div className={s.emptyMark}>{view==="trash"?<Delete24Regular fontSize={30}/>:view==="favorites"?<Star24Regular fontSize={30}/>:<FolderOpen24Regular fontSize={30}/>}</div>
              <Title3>{query?"No matches found":view==="trash"?"Recycle bin is empty":view==="favorites"?"No favorites yet":view==="recent"?"No recent files":"Start with your first file"}</Title3>
              <Body1>{query?"Try another search or clear the search box.":view==="trash"?"Deleted files appear here so you can restore them.":view==="favorites"?"Use the star action on a file to keep it here.":view==="recent"?"Recently changed files will appear here.":"Upload files from your device or create a folder to stay organized."}</Body1>
              {view==="files"&&!query&&<div className={s.actions}><Button appearance="primary" icon={<ArrowUpload24Regular/>} onClick={()=>inputRef.current?.click()}>Upload files</Button><Button appearance="secondary" icon={<FolderAdd24Regular/>} onClick={()=>openEditor("new-folder")}>Create folder</Button></div>}
              {query&&<Button appearance="secondary" onClick={()=>setQuery("")}>Clear search</Button>}
            </div>}
          </>}
          <div className={s.bottomNote}><ShieldCheckmark24Regular/><Caption1>Saved automatically to this browser</Caption1></div>
        </div>
      </main>
    </div>

    {dialog&&dialog!=="preview"&&<Dialog open onOpenChange={(_,data)=>{if(!data.open)closeDialog();}}>
      <DialogSurface><DialogBody><DialogTitle>{dialog==="new-folder"?"Create a folder":dialog==="rename-folder"?"Rename folder":dialog==="rename-file"?"Rename file":"Move file"}</DialogTitle>
        <DialogContent>
          {(dialog==="new-folder"||dialog==="rename-folder"||dialog==="rename-file")&&<Field label={dialog==="new-folder"?"Folder name":"Name"} required><Input autoFocus value={dialogName} onChange={(_,data)=>setDialogName(data.value)} onKeyDown={e=>{if(e.key==="Enter")(dialog==="new-folder"?createFolder():rename());}}/></Field>}
          {dialog==="move"&&<Field label="Destination folder"><Dropdown value={moveTarget==="root"?"My files (root)":folderLabel(moveTarget)} selectedOptions={[moveTarget]} onOptionSelect={(_,data)=>setMoveTarget(data.optionValue||"root")}><Option value="root">My files (root)</Option>{folders.filter(f=>f.id!==dialogTarget?.folderId).map(f=><Option key={f.id} value={f.id}>{f.name}</Option>)}</Dropdown><Caption1>Files remain in this browser; only their folder changes.</Caption1></Field>}
        </DialogContent>
        <DialogActions><Button appearance="secondary" onClick={closeDialog}>Cancel</Button><Button appearance="primary" disabled={dialog!=="move"&&!dialogName.trim()} onClick={dialog==="new-folder"?createFolder:dialog==="move"?async()=>{const dest=moveTarget==="root"?null:getFolder(moveTarget);await write("files",{...dialogTarget,folderId:dest?.id||null,modifiedAt:Date.now()});closeDialog();await refresh();toast("File moved.");}:rename}>{dialog==="new-folder"?"Create":dialog==="move"?"Move":"Save"}</Button></DialogActions>
      </DialogBody></DialogSurface>
    </Dialog>}

    {dialog==="preview"&&previewFile&&<Dialog open onOpenChange={(_,data)=>{if(!data.open)closePreview();}}><DialogSurface className="ff-preview-dialog"><DialogBody>
      <DialogTitle>{previewFile.name}</DialogTitle><DialogContent>
        <div style={{display:"flex",gap:10,marginBottom:12,color:tokens.colorNeutralForeground2}}><Caption1>{size(previewFile.size)}</Caption1><Caption1>Modified {date(previewFile.modifiedAt)}</Caption1></div>
        <div className={s.preview}>
          {kind(previewFile)==="image"&&<img className={s.previewImage} src={previewUrl} alt={previewFile.name}/>}
          {kind(previewFile)==="pdf"&&<iframe title={"Preview of "+previewFile.name} src={previewUrl} style={{width:"100%",height:"62vh",border:0,background:"#fff"}}/>}
          {kind(previewFile)==="video"&&<video className={s.previewVideo} src={previewUrl} controls/>}
          {kind(previewFile)==="audio"&&<audio src={previewUrl} controls/>}
          {kind(previewFile)==="text"&&<pre className={s.previewText}>{previewText}</pre>}
          {kind(previewFile)==="file"&&<div style={{padding:36,display:"grid",justifyItems:"center",gap:12}}><Attach24Regular fontSize={42}/><Body1>No preview is available for this file type.</Body1></div>}
        </div>
      </DialogContent><DialogActions><Button appearance="secondary" icon={<Star24Regular/>} onClick={()=>action("favorite",previewFile)}>{previewFile.favorite?"Remove favorite":"Add to favorites"}</Button><Button appearance="secondary" onClick={closePreview}>Close</Button><Button appearance="primary" icon={<ArrowDownload24Regular/>} onClick={()=>download(previewFile)}>Download</Button></DialogActions>
    </DialogBody></DialogSurface></Dialog>}
    {notice&&<div className={s.toast} role="status"><Text>{notice}</Text><Button appearance="subtle" size="small" icon={<Dismiss24Regular/>} aria-label="Dismiss notification" onClick={()=>setNotice("")}/></div>}
  </FluentProvider>;
}
export default App;
