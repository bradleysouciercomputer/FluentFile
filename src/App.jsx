import React, { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import {
  FluentProvider, webLightTheme, webDarkTheme, makeStyles, tokens,
  Button, Input, SearchBox, Checkbox, Text, Title2, Title3, Body1, Caption1,
  Card, Divider, Toolbar, ToolbarButton, Badge, Tooltip, Spinner,
  MessageBar, MessageBarBody, Dialog, DialogSurface, DialogBody,
  DialogTitle, DialogContent, DialogActions, Field, Dropdown, Option,
  Switch, Menu, MenuTrigger, MenuPopover, MenuList, MenuItem, ProgressBar
} from "@fluentui/react-components";
import {
  Folder24Regular, FolderOpen24Regular, Home24Regular, Clock24Regular,
  Star24Regular, Delete24Regular, ArrowUpload24Regular, ArrowDownload24Regular,
  MoreHorizontal24Regular, Grid24Regular, AppsList24Regular, Document24Regular,
  Image24Regular, VideoClip24Regular, ArrowUndo24Regular, PaintBrush24Regular,
  Rename24Regular, Dismiss24Regular, ShieldCheckmark24Regular, FolderAdd24Regular,
  ChevronRight12Regular, ArrowMove24Regular, DocumentPdf24Regular, Attach24Regular,
  Open24Regular
} from "@fluentui/react-icons";

const DB = "fluentfile-browser-store";
const DOC_MIME = "application/vnd.fluentfile.document+html";
const CANVAS_MIME = "application/vnd.fluentfile.canvas+json";
const isDocument = file => Boolean(file && file.type === DOC_MIME);
const isCanvas = file => Boolean(file && file.type === CANVAS_MIME);
const escapedHtml = value => String(value || "").replace(/[&<>"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[char]));
const sanitizeDocHtml = input => {
  const parsed = new DOMParser().parseFromString(String(input || ""), "text/html");
  parsed.querySelectorAll("script,style,iframe,object,embed,form,svg,math,video,audio,link,meta,base,textarea,button").forEach(node => node.remove());
  const allowed = new Set(["p","br","strong","b","em","i","u","s","del","ul","ol","li","h1","h2","h3","blockquote","pre","code","hr","a","div","label","span","input"]);
  Array.from(parsed.body.querySelectorAll("*")).forEach(node => {
    if (!node.isConnected) return;
    const tag = node.tagName.toLowerCase();
    if (tag === "input") {
      if (node.getAttribute("type") !== "checkbox" || !node.closest('li[data-type="taskItem"]')) {
        node.remove();
        return;
      }
    }
    if (!allowed.has(tag)) {
      const parent = node.parentNode;
      if (parent) {
        while (node.firstChild) parent.insertBefore(node.firstChild, node);
        parent.removeChild(node);
      }
      return;
    }
    Array.from(node.attributes).forEach(attribute => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value;
      if (tag === "a" && ["href","target","rel","title"].includes(name)) return;
      if ((tag === "ul" && name === "data-type" && value === "taskList") ||
          (tag === "li" && name === "data-type" && value === "taskItem") ||
          (tag === "li" && name === "data-checked" && ["true","false"].includes(value))) return;
      if (tag === "input" && name === "type" && value === "checkbox") return;
      if (tag === "input" && ["checked","disabled"].includes(name)) return;
      if (tag === "input" && name === "aria-label") return;
      node.removeAttribute(attribute.name);
    });
    if (tag === "a") {
      const href = node.getAttribute("href");
      if (href) {
        try {
          const parsedUrl = new URL(href, window.location.href);
          if (!["http:","https:","mailto:","tel:"].includes(parsedUrl.protocol)) node.removeAttribute("href");
        } catch {
          node.removeAttribute("href");
        }
      }
      if (node.getAttribute("target") === "_blank") node.setAttribute("rel", "noopener noreferrer");
    }
  });
  return parsed.body.innerHTML.trim() || "<p></p>";
};
const htmlToMarkdown = html => {
  const body = new DOMParser().parseFromString(sanitizeDocHtml(html), "text/html").body;
  const fence = String.fromCharCode(96).repeat(3);
  const render = (node, inPre = false) => {
    if (node.nodeType === 3) return inPre ? node.nodeValue : node.nodeValue.replace(/\s+/g, " ");
    if (node.nodeType !== 1) return "";
    const tag = node.tagName.toLowerCase();
    if (tag === "pre") return fence + "\n" + node.textContent.replace(/\n?$/, "\n") + fence + "\n\n";
    if (tag === "code") return node.parentElement?.tagName.toLowerCase() === "pre" ? node.textContent : String.fromCharCode(96) + node.textContent + String.fromCharCode(96);
    const children = Array.from(node.childNodes).map(child => render(child, inPre || tag === "pre")).join("");
    if (tag === "h1") return "# " + children.trim() + "\n\n";
    if (tag === "h2") return "## " + children.trim() + "\n\n";
    if (tag === "h3") return "### " + children.trim() + "\n\n";
    if (tag === "p") return children.trim() ? children.trim() + "\n\n" : "\n";
    if (tag === "strong" || tag === "b") return "**" + children + "**";
    if (tag === "em" || tag === "i") return "*" + children + "*";
    if (tag === "s" || tag === "del") return "~~" + children + "~~";
    if (tag === "a") return node.getAttribute("href") ? "[" + children + "](" + node.getAttribute("href").replace(/\)/g, "%29") + ")" : children;
    if (tag === "br") return "\n";
    if (tag === "hr") return "\n---\n\n";
    if (tag === "li") {
      const parent = node.parentElement;
      const parentTag = parent?.tagName.toLowerCase();
      const prefix = parent?.getAttribute("data-type") === "taskList" ? (node.getAttribute("data-checked") === "true" ? "[x] " : "[ ] ") : parentTag === "ol" ? (Array.from(parent.children).indexOf(node) + 1) + ". " : "- ";
      return prefix + children.trim() + "\n";
    }
    if (tag === "ul" || tag === "ol") return children + "\n";
    if (tag === "blockquote") return children.trim().split("\n").map(line => line ? "> " + line : ">").join("\n") + "\n\n";
    return children;
  };
  return render(body).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
};
const fullDocumentHtml = (title, body) => "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>"+escapedHtml(title)+"</title><style>body{font:16px/1.65 Segoe UI,Arial,sans-serif;max-width:800px;margin:48px auto;padding:0 24px;color:#222}h1,h2,h3{line-height:1.25}img{max-width:100%}pre{white-space:pre-wrap}</style></head><body>"+sanitizeDocHtml(body)+"</body></html>";
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
  if (isDocument(file)) return "document";
  if (isCanvas(file)) return "canvas";
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
    case "audio": return <Document24Regular />;
    case "pdf": return <DocumentPdf24Regular />;
    case "document": return <Document24Regular />;
    case "canvas": return <PaintBrush24Regular />;
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

function FileCard({file,layout,styles,onAction,onPreview,onCopyLink,selected,onSelect}) {
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
      <div className={styles.fileNameRow}><Checkbox checked={selected} onChange={(_,data)=>onSelect(file.id,data.checked)} aria-label={"Select "+file.name}/><Text weight="semibold" className={styles.itemName} title={file.name}>{file.name}</Text>{file.favorite && !isDeleted(file) && <Star24Regular color="#C19C00" />}</div>
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
            <MenuItem onClick={() => onCopyLink(isDocument(file)?"doc":"file",file)}>{isDocument(file)?"Copy document link":"Copy file link"}</MenuItem>
            <MenuItem icon={<Document24Regular/>} onClick={() => onAction("duplicate",file)}>Make a copy</MenuItem>
            <MenuItem icon={<Rename24Regular/>} onClick={() => onAction("rename",file)}>Rename</MenuItem>
            <MenuItem icon={<Delete24Regular/>} onClick={() => onAction("trash",file)}>Move to recycle bin</MenuItem>
          </MenuList></MenuPopover>
        </Menu>
      </>}
    </div>
  </Card>;
}

function FluentDocEditor({fileId, dark, onBack, onCopyLink, onSaved}) {
  const docStyles = makeStyles({
    shell:{minHeight:"100vh",display:"flex",flexDirection:"column",backgroundColor:tokens.colorNeutralBackground2,color:tokens.colorNeutralForeground1},
    header:{display:"flex",alignItems:"center",gap:"12px",flexWrap:"wrap",padding:"12px 22px",backgroundColor:tokens.colorNeutralBackground1,borderBottom:"1px solid "+tokens.colorNeutralStroke2},
    titleInput:{width:"min(480px, 45vw)"},
    status:{color:tokens.colorNeutralForeground3,whiteSpace:"nowrap"},
    toolbar:{display:"flex",alignItems:"center",gap:"4px",flexWrap:"wrap",padding:"10px 22px",backgroundColor:tokens.colorNeutralBackground1,borderBottom:"1px solid "+tokens.colorNeutralStroke2},
    workarea:{flex:1,padding:"24px 16px 60px"},
    paper:{maxWidth:"920px",minHeight:"72vh",margin:"0 auto",backgroundColor:tokens.colorNeutralBackground1,border:"1px solid "+tokens.colorNeutralStroke2,borderRadius:tokens.borderRadiusLarge,boxShadow:tokens.shadow4,overflow:"hidden"},
    editor:{minHeight:"72vh",padding:"48px clamp(22px, 7vw, 88px)",fontSize:"16px",lineHeight:"1.7",color:tokens.colorNeutralForeground1,outline:"none"},
    footer:{padding:"10px 22px",display:"flex",alignItems:"center",flexWrap:"wrap",gap:"8px",color:tokens.colorNeutralForeground3,backgroundColor:tokens.colorNeutralBackground1,borderTop:"1px solid "+tokens.colorNeutralStroke2}
  });
  const s=docStyles();
  const [record,setRecord]=useState(null);
  const [title,setTitle]=useState("");
  const [html,setHtml]=useState("<p></p>");
  const [ready,setReady]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [status,setStatus]=useState("Loading document…");
  const [lastSaved,setLastSaved]=useState("");
  const [error,setError]=useState("");
  const [findOpen,setFindOpen]=useState(false);
  const [outlineOpen,setOutlineOpen]=useState(false);
  const [findText,setFindText]=useState("");
  const [replaceText,setReplaceText]=useState("");
  const [findCaseSensitive,setFindCaseSensitive]=useState(false);
  const [findMessage,setFindMessage]=useState("");
  const recordRef=useRef(null), titleRef=useRef(title), htmlRef=useRef(html), readyRef=useRef(false), loadGeneration=useRef(0);
  const saveQueue=useRef(Promise.resolve()), saveVersion=useRef(0), dirtyRef=useRef(false);
  const markDirty=()=>{dirtyRef.current=true;setDirty(true);};
  titleRef.current=title;htmlRef.current=html;
  const editor=useEditor({
    extensions:[StarterKit.configure({heading:{levels:[1,2,3]}}),TaskList.configure({HTMLAttributes:{class:"ff-task-list"}}),TaskItem.configure({nested:true,HTMLAttributes:{class:"ff-task-item"}})],
    content:"<p></p>",
    onUpdate:({editor})=>{
      if(!readyRef.current)return;
      setHtml(editor.getHTML());
      markDirty();
      setStatus("Unsaved changes");
    },
    editorProps:{attributes:{"class":"tiptap","aria-label":"Document editor","spellcheck":"true"}}
  });
  useEffect(()=>{
    if(!editor)return;
    let active=true;
    const generation=++loadGeneration.current;
    readyRef.current=false;setReady(false);setStatus("Loading document…");setError("");
    getAll("files").then(async files=>{
      const found=files.find(file=>file.id===fileId&&isDocument(file));
      if(!found)throw new Error("This document could not be found in this browser.");
      const content=sanitizeDocHtml(await found.blob.text());
      if(!active||generation!==loadGeneration.current)return;
      recordRef.current=found;setRecord(found);setTitle(found.name);setHtml(content);
      editor.commands.setContent(content,{emitUpdate:false});
      dirtyRef.current=false;setDirty(false);
      readyRef.current=true;setReady(true);
      setLastSaved(found.modifiedAt?new Date(found.modifiedAt).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"}):"");
      setStatus("Saved on this device");
    }).catch(e=>{if(active){setError(e.message||"Could not open this document.");setStatus("Could not load document.");}});
    return ()=>{active=false;};
  },[editor,fileId]);
  const persist=async(nextTitle,nextHtml)=>{
    const existing=recordRef.current;
    if(!existing||!readyRef.current)return false;
    if(!dirtyRef.current)return true;
    const version=++saveVersion.current;
    const normalized=(nextTitle||"").trim()||"Untitled document";
    const cleanHtml=sanitizeDocHtml(nextHtml||"<p></p>");
    const blob=new Blob([cleanHtml],{type:DOC_MIME});
    const updated={...existing,name:normalized,type:DOC_MIME,blob,size:blob.size,modifiedAt:Date.now()};
    setStatus("Saving…");
    const task=saveQueue.current.catch(()=>{}).then(()=>write("files",updated));
    saveQueue.current=task;
    try{
      await task;
      if(version!==saveVersion.current)return true;
      recordRef.current=updated;setRecord(updated);
      setError("");
      if(onSaved) await onSaved();
      if(version!==saveVersion.current)return true;
      const sameAsCurrent=normalized===(((titleRef.current||"").trim())||"Untitled document")&&cleanHtml===sanitizeDocHtml(htmlRef.current||"<p></p>");
      if(sameAsCurrent){
        dirtyRef.current=false;setDirty(false);
        setStatus("Saved on this device");
        setLastSaved(new Date(updated.modifiedAt).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"}));
      }else setStatus("Unsaved changes");
      return true;
    }catch(e){
      if(version===saveVersion.current){setStatus("Save failed");setError(e.message||"Could not save document.");}
      return false;
    }
  };
  useEffect(()=>{
    if(!ready||!dirty||!recordRef.current)return;
    const timer=setTimeout(()=>{persist(title,html);},650);
    return ()=>clearTimeout(timer);
  },[title,html,ready,dirty]);
  useEffect(()=>()=> {
    if(!readyRef.current||!recordRef.current||!dirtyRef.current)return;
    const existing=recordRef.current;
    const normalized=(titleRef.current||"").trim()||"Untitled document";
    const blob=new Blob([sanitizeDocHtml(htmlRef.current||"<p></p>")],{type:DOC_MIME});
    const finalRecord={...existing,name:normalized,type:DOC_MIME,blob,size:blob.size,modifiedAt:Date.now()};
    ++saveVersion.current;
    const task=saveQueue.current.catch(()=>{}).then(()=>write("files",finalRecord));
    saveQueue.current=task;
    task.catch(()=>{});
  },[]);
  useEffect(()=>{
    const handleKey=event=>{
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="s"){
        event.preventDefault();persist(titleRef.current,htmlRef.current);
      }
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="h"){
        event.preventDefault();setFindOpen(open=>!open);setFindMessage("");
      }
      if((event.ctrlKey||event.metaKey)&&event.altKey&&event.key.toLowerCase()==="o"){
        event.preventDefault();setOutlineOpen(open=>!open);
      }
    };
    window.addEventListener("keydown",handleKey);
    return ()=>window.removeEventListener("keydown",handleKey);
  },[]);
  const run=command=>{if(editor)command(editor.chain().focus()).run();};
  const findMatches=()=>{
    if(!editor||!findText)return [];
    const escaped=Array.from(findText).map(char=>/[.*+?^$()|[\]\\{}]/.test(char)?"\\"+char:char).join("");
    const matcher=new RegExp(escaped,findCaseSensitive?"g":"giu");
    const matches=[];
    let runText="",runStart=0,runEnd=0;
    const flush=()=>{
      if(!runText)return;
      matcher.lastIndex=0;
      let match;
      while((match=matcher.exec(runText))!==null){
        matches.push({from:runStart+match.index,to:runStart+match.index+match[0].length});
        if(!match[0].length)matcher.lastIndex++;
      }
      runText="";
    };
    editor.state.doc.descendants((node,pos)=>{
      if(!node.isText||!node.text)return;
      if(runText&&pos!==runEnd)flush();
      if(!runText)runStart=pos;
      runText+=node.text;
      runEnd=pos+node.nodeSize;
    });
    flush();
    return matches;
  };
  const findNext=()=>{
    const matches=findMatches();
    if(!matches.length){setFindMessage("No matches found.");return;}
    const selection=editor.state.selection;
    const next=matches.find(match=>match.from>=selection.to&&(selection.empty||match.from!==selection.from))||matches[0];
    editor.chain().focus().setTextSelection({from:next.from,to:next.to}).run();
    setFindMessage("Match selected. "+matches.length+" occurrence"+(matches.length===1?"":"s")+" found.");
  };
  const replaceCurrent=()=>{
    if(!editor||!findText){setFindMessage("Enter text to find first.");return;}
    const selection=editor.state.selection;
    const selected=editor.state.doc.textBetween(selection.from,selection.to,"");
    const equal=findCaseSensitive?selected===findText:selected.toLocaleLowerCase()===findText.toLocaleLowerCase();
    if(!selection.empty&&equal){
      editor.chain().focus().insertContentAt({from:selection.from,to:selection.to},replaceText).run();
      setFindMessage("Replaced the selected match.");
      return;
    }
    findNext();
  };
  const replaceAll=()=>{
    if(!editor||!findText){setFindMessage("Enter text to find first.");return;}
    const matches=findMatches();
    if(!matches.length){setFindMessage("No matches found.");return;}
    editor.chain().focus().command(({tr})=>{
      [...matches].reverse().forEach(match=>tr.insertText(replaceText,match.from,match.to));
      return true;
    }).run();
    setFindMessage("Replaced "+matches.length+" occurrence"+(matches.length===1?"":"s")+".");
  };
  const addLink=()=>{
    if(!editor)return;
    const current=editor.getAttributes("link").href||"https://";
    const url=window.prompt("Enter a link URL",current);
    if(url===null)return;
    if(!url.trim()){editor.chain().focus().extendMarkRange("link").unsetLink().run();return;}
    const value=url.trim();
    const normalized=/^[a-z][a-z0-9+.-]*:/i.test(value)?value:"https://"+value;
    try{
      const parsed=new URL(normalized,window.location.href);
      if(!["http:","https:","mailto:","tel:"].includes(parsed.protocol)||(["http:","https:"].includes(parsed.protocol)&&!parsed.hostname)){
        setError("Use an http, https, mailto, or tel link.");return;
      }
      const href=["mailto:","tel:"].includes(parsed.protocol)?normalized:parsed.href;
      editor.chain().focus().extendMarkRange("link").setLink({href,target:"_blank",rel:"noopener noreferrer"}).run();
      setError("");
    }catch{setError("That link could not be added. Use a valid http, https, mailto, or tel address.");}
  };
  const exportAs=async format=>{
    if(!editor)return;
    const safe=(title||"Untitled document").trim()||"Untitled document";
    const content=format==="txt"?editor.getText("\n"):format==="md"?htmlToMarkdown(editor.getHTML()):fullDocumentHtml(safe,editor.getHTML());
    const mime=format==="txt"?"text/plain;charset=utf-8":format==="md"?"text/markdown;charset=utf-8":"text/html;charset=utf-8";
    const blob=new Blob([content],{type:mime});
    const url=URL.createObjectURL(blob),anchor=document.createElement("a");
    anchor.href=url;anchor.download=safe.replace(/[\\\\/:*?"<>|]/g,"_")+(format==="txt"?".txt":format==="md"?".md":".html");
    document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  };
  const copyLink=()=>onCopyLink("doc",record);
  const insertCurrentStamp=format=>{
    if(!editor)return;
    const now=new Date();
    const value=format==="date"
      ?new Intl.DateTimeFormat(undefined,{dateStyle:"long"}).format(now)
      :new Intl.DateTimeFormat(undefined,{hour:"numeric",minute:"2-digit"}).format(now);
    editor.chain().focus().insertContent(value).run();
  };
  const headings=[];
  if(editor)editor.state.doc.descendants((node,pos)=>{
    if(node.type.name==="heading")headings.push({pos,level:node.attrs.level,text:node.textContent.trim()||"Untitled heading"});
  });
  const plainText=editor?.getText("\n")||"";
  const wordCount=(plainText.match(/\S+/g)||[]).length;
  const characterCount=plainText.length;
  const readingMinutes=Math.max(1,Math.ceil(wordCount/200));
  return <FluentProvider theme={dark?webDarkTheme:webLightTheme}>
    <div className={s.shell+" ff-doc-page"}>
      <header className={s.header+" ff-doc-header"}>
        <Button appearance="subtle" onClick={async()=>{if(record){const saved=await persist(titleRef.current,htmlRef.current);if(saved)onBack(record.folderId);}else onBack(null);}} icon={<FolderOpen24Regular/>}>Back to files</Button>
        <div style={{minWidth:0,display:"grid",gap:2}}>
          <Input className={s.titleInput+" ff-doc-title-input"} size="large" value={title} onChange={(_,data)=>{setTitle(data.value);markDirty();}} placeholder="Untitled document" aria-label="Document title"/>
          <Text size={100} className={s.status}>{status}{lastSaved&&status==="Saved on this device"?" · "+lastSaved:""}</Text>
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:8,flexWrap:"wrap"}}>
          <Button appearance="secondary" onClick={copyLink} disabled={!record}>Copy link</Button>
          <Menu><MenuTrigger disableButtonEnhancement><Button appearance="secondary" icon={<ArrowDownload24Regular/>}>Export</Button></MenuTrigger><MenuPopover><MenuList><MenuItem onClick={()=>exportAs("html")}>Download as HTML</MenuItem><MenuItem onClick={()=>exportAs("md")}>Download as Markdown</MenuItem><MenuItem onClick={()=>exportAs("txt")}>Download as plain text</MenuItem><MenuItem onClick={()=>window.print()}>Print document</MenuItem></MenuList></MenuPopover></Menu>
          <Button appearance="primary" onClick={()=>persist(titleRef.current,htmlRef.current)} disabled={!ready}>Save now</Button>
        </div>
      </header>
      <div className={s.toolbar+" ff-doc-toolbar"} role="toolbar" aria-label="Document formatting">
        <Tooltip content="Paragraph" relationship="label"><Button size="small" appearance={editor?.isActive("paragraph")?"primary":"subtle"} onClick={()=>run(chain=>chain.setParagraph())}>P</Button></Tooltip>
        <Tooltip content="Heading 1" relationship="label"><Button size="small" appearance={editor?.isActive("heading",{level:1})?"primary":"subtle"} onClick={()=>run(chain=>chain.toggleHeading({level:1}))}>H1</Button></Tooltip>
        <Tooltip content="Heading 2" relationship="label"><Button size="small" appearance={editor?.isActive("heading",{level:2})?"primary":"subtle"} onClick={()=>run(chain=>chain.toggleHeading({level:2}))}>H2</Button></Tooltip>
        <Tooltip content="Heading 3" relationship="label"><Button size="small" appearance={editor?.isActive("heading",{level:3})?"primary":"subtle"} onClick={()=>run(chain=>chain.toggleHeading({level:3}))}>H3</Button></Tooltip>
        <Divider vertical/>
        <Tooltip content="Bold (Ctrl+B)" relationship="label"><Button size="small" appearance={editor?.isActive("bold")?"primary":"subtle"} onClick={()=>run(chain=>chain.toggleBold())}>B</Button></Tooltip>
        <Tooltip content="Italic (Ctrl+I)" relationship="label"><Button size="small" appearance={editor?.isActive("italic")?"primary":"subtle"} onClick={()=>run(chain=>chain.toggleItalic())}>I</Button></Tooltip>
        <Tooltip content="Underline" relationship="label"><Button size="small" appearance={editor?.isActive("underline")?"primary":"subtle"} onClick={()=>run(chain=>chain.toggleUnderline())}><span style={{textDecoration:"underline"}}>U</span></Button></Tooltip>
        <Tooltip content="Strikethrough" relationship="label"><Button size="small" appearance={editor?.isActive("strike")?"primary":"subtle"} onClick={()=>run(chain=>chain.toggleStrike())}><span style={{textDecoration:"line-through"}}>S</span></Button></Tooltip>
        <Divider vertical/>
        <Tooltip content="Bulleted list" relationship="label"><Button size="small" appearance={editor?.isActive("bulletList")?"primary":"subtle"} onClick={()=>run(chain=>chain.toggleBulletList())}>• List</Button></Tooltip>
        <Tooltip content="Numbered list" relationship="label"><Button size="small" appearance={editor?.isActive("orderedList")?"primary":"subtle"} onClick={()=>run(chain=>chain.toggleOrderedList())}>1. List</Button></Tooltip>
        <Tooltip content="Checklist" relationship="label"><Button size="small" appearance={editor?.isActive("taskList")?"primary":"subtle"} onClick={()=>run(chain=>chain.toggleTaskList())}>☑ Tasks</Button></Tooltip>
        <Tooltip content="Block quote" relationship="label"><Button size="small" appearance={editor?.isActive("blockquote")?"primary":"subtle"} onClick={()=>run(chain=>chain.toggleBlockquote())}>Quote</Button></Tooltip>
        <Tooltip content="Code block" relationship="label"><Button size="small" appearance={editor?.isActive("codeBlock")?"primary":"subtle"} onClick={()=>run(chain=>chain.toggleCodeBlock())}>Code</Button></Tooltip>
        <Divider vertical/>
        <Tooltip content="Insert or edit link" relationship="label"><Button size="small" appearance={editor?.isActive("link")?"primary":"subtle"} onClick={addLink}>Link</Button></Tooltip>
        <Tooltip content="Insert a divider" relationship="label"><Button size="small" appearance="subtle" onClick={()=>run(chain=>chain.setHorizontalRule())}>Divider</Button></Tooltip>
        <Menu><MenuTrigger disableButtonEnhancement><Button size="small" appearance="subtle">Insert date/time</Button></MenuTrigger><MenuPopover><MenuList><MenuItem onClick={()=>insertCurrentStamp("date")}>Insert today’s date</MenuItem><MenuItem onClick={()=>insertCurrentStamp("time")}>Insert current time</MenuItem></MenuList></MenuPopover></Menu>
        <Tooltip content="Remove formatting" relationship="label"><Button size="small" appearance="subtle" onClick={()=>run(chain=>chain.unsetAllMarks().clearNodes())}>Clear format</Button></Tooltip>
        <span style={{flex:1}}/>
        <Button size="small" appearance={outlineOpen?"primary":"subtle"} onClick={()=>setOutlineOpen(open=>!open)}>Outline</Button>
        <Button size="small" appearance={findOpen?"primary":"subtle"} onClick={()=>{setFindOpen(open=>!open);setFindMessage("");}}>Find &amp; replace</Button>
        <Button size="small" appearance="subtle" onClick={()=>run(chain=>chain.undo())} disabled={!editor?.can().undo()}>Undo</Button>
        <Button size="small" appearance="subtle" onClick={()=>run(chain=>chain.redo())} disabled={!editor?.can().redo()}>Redo</Button>
      </div>
      {outlineOpen&&<div className="ff-doc-outline-panel" style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",padding:"10px 22px",backgroundColor:tokens.colorNeutralBackground1,borderBottom:"1px solid "+tokens.colorNeutralStroke2}}>
        <Caption1>DOCUMENT OUTLINE</Caption1>
        {headings.length?headings.map((heading,index)=><Button key={heading.pos+"-"+index} size="small" appearance="subtle" style={{marginLeft:(heading.level-1)*8,maxWidth:260}} onClick={()=>editor?.chain().focus().setTextSelection(Math.min(heading.pos+1,editor.state.doc.content.size)).scrollIntoView().run()} title={heading.text}>{heading.text}</Button>):<Caption1>Add H1, H2, or H3 headings to build an outline.</Caption1>}
        <Button size="small" appearance="subtle" onClick={()=>setOutlineOpen(false)}>Close</Button>
      </div>}
      {findOpen&&<div className="ff-doc-find-panel" style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",padding:"10px 22px",backgroundColor:tokens.colorNeutralBackground1,borderBottom:"1px solid "+tokens.colorNeutralStroke2}}>
        <Input value={findText} onChange={(_,data)=>{setFindText(data.value);setFindMessage("");}} placeholder="Find text" aria-label="Find text" onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();findNext();}}}/>
        <Input value={replaceText} onChange={(_,data)=>setReplaceText(data.value)} placeholder="Replace with" aria-label="Replacement text" onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();replaceCurrent();}}}/>
        <Checkbox checked={findCaseSensitive} onChange={(_,data)=>setFindCaseSensitive(data.checked)} label="Match case"/>
        <Button size="small" appearance="secondary" onClick={findNext} disabled={!findText}>Find next</Button>
        <Button size="small" appearance="secondary" onClick={replaceCurrent} disabled={!findText}>Replace</Button>
        <Button size="small" appearance="primary" onClick={replaceAll} disabled={!findText}>Replace all</Button>
        <Button size="small" appearance="subtle" onClick={()=>{setFindOpen(false);setFindMessage("");}}>Close</Button>
        {findMessage&&<Caption1 role="status">{findMessage}</Caption1>}
      </div>}
      <main className={s.workarea+" ff-doc-workarea"}>
        {error&&<div style={{maxWidth:920,margin:"0 auto 12px"}}><MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar></div>}
        {!editor||!ready?<div style={{padding:40,display:"flex",justifyContent:"center"}}><Spinner label={error?"Document unavailable":"Loading document…"}/></div>:
          <div className={s.paper+" ff-doc-paper"}><EditorContent editor={editor} className="ff-doc-editor-content"/></div>}
      </main>
      <footer className={s.footer+" ff-doc-footer"}><ShieldCheckmark24Regular/><Caption1>Stored locally in this browser</Caption1><span style={{flex:1}}/><Caption1>{wordCount} words · {characterCount} characters · about {readingMinutes} min read</Caption1><Caption1>Ctrl/⌘+S saves · Ctrl/⌘+H finds text</Caption1></footer>
    </div>
  </FluentProvider>;
}


function drawFluentCanvas(canvas, model, showGrid = false) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const width = model.width || 1200, height = model.height || 800;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = model.background || "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (showGrid) {
    ctx.save();
    ctx.strokeStyle = "rgba(100,116,139,.18)";
    ctx.lineWidth = 1;
    for (let x = 40; x < width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    for (let y = 40; y < height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    ctx.restore();
  }
  (model.elements || []).forEach(element => {
    const points = element.points || [];
    ctx.save();
    ctx.strokeStyle = element.color || "#1f2937";
    ctx.fillStyle = element.color || "#1f2937";
    ctx.lineWidth = Math.max(1, element.size || 4);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (element.type === "path" && points.length) {
      ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
      points.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
      if (points.length === 1) { ctx.lineTo(points[0].x + 0.1, points[0].y + 0.1); }
      ctx.stroke();
    } else if (points.length >= 2 && element.type === "line") {
      ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y); ctx.lineTo(points[1].x, points[1].y); ctx.stroke();
    } else if (points.length >= 2 && element.type === "rect") {
      const left = Math.min(points[0].x, points[1].x), top = Math.min(points[0].y, points[1].y);
      ctx.strokeRect(left, top, Math.abs(points[1].x - points[0].x), Math.abs(points[1].y - points[0].y));
    } else if (points.length >= 2 && element.type === "ellipse") {
      const cx = (points[0].x + points[1].x) / 2, cy = (points[0].y + points[1].y) / 2;
      ctx.beginPath(); ctx.ellipse(cx, cy, Math.abs(points[1].x - points[0].x) / 2, Math.abs(points[1].y - points[0].y) / 2, 0, 0, Math.PI * 2); ctx.stroke();
    } else if (element.type === "text" && element.text) {
      ctx.font = (element.size || 28) + "px Segoe UI, Arial, sans-serif";
      ctx.textBaseline = "top";
      ctx.fillText(element.text, element.x || 0, element.y || 0, Math.max(1, width - (element.x || 0) - 12));
    }
    ctx.restore();
  });
}
function FluentCanvasEditor({fileId, dark, onBack, onCopyLink, onSaved}) {
  const canvasStyles = makeStyles({
    shell:{minHeight:"100vh",display:"flex",flexDirection:"column",backgroundColor:tokens.colorNeutralBackground2,color:tokens.colorNeutralForeground1},
    header:{display:"flex",alignItems:"center",gap:"12px",flexWrap:"wrap",padding:"12px 22px",backgroundColor:tokens.colorNeutralBackground1,borderBottom:"1px solid "+tokens.colorNeutralStroke2},
    titleInput:{width:"min(420px, 44vw)"},
    status:{color:tokens.colorNeutralForeground3,whiteSpace:"nowrap"},
    toolbar:{display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap",padding:"10px 18px",backgroundColor:tokens.colorNeutralBackground1,borderBottom:"1px solid "+tokens.colorNeutralStroke2},
    boardArea:{flex:1,padding:"22px 18px 34px",overflow:"auto"},
    board:{maxWidth:"1280px",margin:"0 auto",border:"1px solid "+tokens.colorNeutralStroke1,borderRadius:tokens.borderRadiusMedium,overflow:"hidden",backgroundColor:"#fff",boxShadow:tokens.shadow8},
    canvas:{display:"block",width:"100%",height:"auto",touchAction:"none",cursor:"crosshair"},
    footer:{display:"flex",alignItems:"center",flexWrap:"wrap",gap:"10px",padding:"10px 18px",backgroundColor:tokens.colorNeutralBackground1,borderTop:"1px solid "+tokens.colorNeutralStroke2,color:tokens.colorNeutralForeground3}
  });
  const s=canvasStyles();
  const [record,setRecord]=useState(null);
  const [title,setTitle]=useState("");
  const [elements,setElements]=useState([]);
  const [background,setBackground]=useState("#ffffff");
  const [tool,setTool]=useState("pen");
  const [color,setColor]=useState("#1f2937");
  const [brushSize,setBrushSize]=useState(5);
  const [showGrid,setShowGrid]=useState(false);
  const [ready,setReady]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [status,setStatus]=useState("Loading canvas…");
  const [lastSaved,setLastSaved]=useState("");
  const [error,setError]=useState("");
  const [canUndo,setCanUndo]=useState(false),[canRedo,setCanRedo]=useState(false);
  const canvasRef=useRef(null),recordRef=useRef(null),titleRef=useRef(""),elementsRef=useRef([]),backgroundRef=useRef("#ffffff");
  const readyRef=useRef(false),dirtyRef=useRef(false),saveQueue=useRef(Promise.resolve()),saveVersion=useRef(0);
  const undoStack=useRef([]),redoStack=useRef([]),drawingIndex=useRef(-1),loadGeneration=useRef(0);
  titleRef.current=title;
  const modelRef=useRef(null);
  const currentModel=()=>({version:1,width:1200,height:800,background:backgroundRef.current,elements:elementsRef.current});
  modelRef.current=currentModel();
  const markDirty=()=>{dirtyRef.current=true;setDirty(true);setStatus("Unsaved changes");};
  const syncHistory=()=>{setCanUndo(undoStack.current.length>0);setCanRedo(redoStack.current.length>0);};
  const setElementModel=next=>{
    elementsRef.current=next;setElements(next);
    modelRef.current={version:1,width:1200,height:800,background:backgroundRef.current,elements:next};
    markDirty();
  };
  const remember=()=>{
    undoStack.current=[...undoStack.current,JSON.parse(JSON.stringify(elementsRef.current))].slice(-80);
    redoStack.current=[];
    syncHistory();
  };
  useEffect(()=>{
    let active=true;
    const generation=++loadGeneration.current;
    readyRef.current=false;setReady(false);setError("");setStatus("Loading canvas…");
    getAll("files").then(async files=>{
      const found=files.find(file=>file.id===fileId&&isCanvas(file));
      if(!found)throw new Error("This canvas could not be found in this browser.");
      let parsed;
      try { parsed=JSON.parse(await found.blob.text()); } catch { throw new Error("This canvas file is damaged or could not be read."); }
      if(!parsed||!Array.isArray(parsed.elements))parsed={version:1,width:1200,height:800,background:"#ffffff",elements:[]};
      if(!active||generation!==loadGeneration.current)return;
      recordRef.current=found;setRecord(found);setTitle(found.name);
      const nextElements=parsed.elements.filter(e=>e&&typeof e.type==="string").map(e=>({...e}));
      elementsRef.current=nextElements;setElements(nextElements);
      const nextBackground=/^#[0-9a-f]{6}$/i.test(parsed.background||"")?parsed.background:"#ffffff";
      backgroundRef.current=nextBackground;setBackground(nextBackground);
      modelRef.current={version:1,width:1200,height:800,background:nextBackground,elements:nextElements};
      undoStack.current=[];redoStack.current=[];syncHistory();
      dirtyRef.current=false;setDirty(false);readyRef.current=true;setReady(true);
      setLastSaved(found.modifiedAt?new Date(found.modifiedAt).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"}):"");
      setStatus("Saved on this device");
    }).catch(e=>{if(active){setError(e.message||"Could not open canvas.");setStatus("Could not load canvas.");}});
    return ()=>{active=false;};
  },[fileId]);
  useEffect(()=>{drawFluentCanvas(canvasRef.current,currentModel(),showGrid);},[elements,background,showGrid,ready]);
  const persist=async(nextTitle,model=currentModel())=>{
    const existing=recordRef.current;
    if(!existing||!readyRef.current||!dirtyRef.current)return false;
    const version=++saveVersion.current;
    const normalized=(nextTitle||"").trim()||"Untitled canvas";
    const payload={version:1,width:1200,height:800,background:model.background||"#ffffff",elements:model.elements||[]};
    const blob=new Blob([JSON.stringify(payload)],{type:CANVAS_MIME});
    const updated={...existing,name:normalized,type:CANVAS_MIME,blob,size:blob.size,modifiedAt:Date.now()};
    setStatus("Saving…");
    const task=saveQueue.current.catch(()=>{}).then(()=>write("files",updated));
    saveQueue.current=task;
    try{
      await task;
      if(version!==saveVersion.current)return true;
      recordRef.current=updated;setRecord(updated);setError("");
      if(onSaved)await onSaved();
      if(version!==saveVersion.current)return true;
      const latest=currentModel();
      if(normalized===((titleRef.current||"").trim()||"Untitled canvas")&&JSON.stringify(payload)===JSON.stringify(latest)){
        dirtyRef.current=false;setDirty(false);setStatus("Saved on this device");
        setLastSaved(new Date(updated.modifiedAt).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"}));
      } else setStatus("Unsaved changes");
      return true;
    }catch(e){if(version===saveVersion.current){setStatus("Save failed");setError(e.message||"Could not save canvas.");}return false;}
  };
  useEffect(()=>{
    if(!ready||!dirty)return;
    const snapshot={version:1,width:1200,height:800,background,elements};
    const timer=setTimeout(()=>persist(title,snapshot),700);
    return ()=>clearTimeout(timer);
  },[ready,dirty,title,elements,background]);
  useEffect(()=>()=> {
    if(!readyRef.current||!dirtyRef.current||!recordRef.current)return;
    const existing=recordRef.current;
    const model=currentModel(),normalized=(titleRef.current||"").trim()||"Untitled canvas";
    const blob=new Blob([JSON.stringify(model)],{type:CANVAS_MIME});
    const finalRecord={...existing,name:normalized,type:CANVAS_MIME,blob,size:blob.size,modifiedAt:Date.now()};
    ++saveVersion.current;
    const task=saveQueue.current.catch(()=>{}).then(()=>write("files",finalRecord));
    saveQueue.current=task;task.catch(()=>{});
  },[]);
  useEffect(()=>{
    const onKey=event=>{
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="s"){event.preventDefault();persist(titleRef.current,currentModel());}
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="z"&&!event.shiftKey){event.preventDefault();undo();}
      if((event.ctrlKey||event.metaKey)&&(event.key.toLowerCase()==="y"||(event.shiftKey&&event.key.toLowerCase()==="z"))){event.preventDefault();redo();}
    };
    window.addEventListener("keydown",onKey);
    return ()=>window.removeEventListener("keydown",onKey);
  },[]);
  const undo=()=>{
    if(!undoStack.current.length)return;
    redoStack.current=[...redoStack.current,JSON.parse(JSON.stringify(elementsRef.current))];
    const next=undoStack.current.pop();
    setElementModel(next);syncHistory();
  };
  const redo=()=>{
    if(!redoStack.current.length)return;
    undoStack.current=[...undoStack.current,JSON.parse(JSON.stringify(elementsRef.current))];
    const next=redoStack.current.pop();
    setElementModel(next);syncHistory();
  };
  const pointFromEvent=event=>{
    const rect=event.currentTarget.getBoundingClientRect();
    return {x:Math.max(0,Math.min(1200,(event.clientX-rect.left)*1200/rect.width)),y:Math.max(0,Math.min(800,(event.clientY-rect.top)*800/rect.height))};
  };
  const startDrawing=event=>{
    if(!ready)return;
    if(event.button!==undefined&&event.button!==0)return;
    const point=pointFromEvent(event);
    if(tool==="text"){
      const value=window.prompt("Text to add to the canvas");
      if(value===null||!value.trim())return;
      remember();
      const next=[...elementsRef.current,{type:"text",x:point.x,y:point.y,text:value.trim(),color,size:Math.max(14,brushSize*5)}];
      setElementModel(next);return;
    }
    remember();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const shapeType=tool==="line"||tool==="rect"||tool==="ellipse"?tool:"path";
    const element={type:shapeType,color:tool==="eraser"?backgroundRef.current:color,size:tool==="eraser"?Math.max(12,brushSize*4):brushSize,points:[point]};
    const next=[...elementsRef.current,element];
    elementsRef.current=next;drawingIndex.current=next.length-1;setElements(next);modelRef.current={version:1,width:1200,height:800,background:backgroundRef.current,elements:next};markDirty();
  };
  const continueDrawing=event=>{
    const index=drawingIndex.current;
    if(index<0)return;
    const point=pointFromEvent(event);
    const next=elementsRef.current.map((element,i)=>{
      if(i!==index)return element;
      if(element.type==="path")return {...element,points:[...element.points,point]};
      return {...element,points:[element.points[0],point]};
    });
    elementsRef.current=next;setElements(next);modelRef.current={version:1,width:1200,height:800,background:backgroundRef.current,elements:next};markDirty();
  };
  const stopDrawing=event=>{
    drawingIndex.current=-1;
    try{if(event.currentTarget.hasPointerCapture?.(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}catch{}
  };
  const changeBackground=value=>{
    if(!/^#[0-9a-f]{6}$/i.test(value))return;
    backgroundRef.current=value;setBackground(value);modelRef.current={version:1,width:1200,height:800,background:value,elements:elementsRef.current};markDirty();
  };
  const clearCanvas=()=>{
    if(!elementsRef.current.length)return;
    if(!window.confirm("Clear the entire canvas? You can undo this action."))return;
    remember();setElementModel([]);
  };
  const exportPNG=()=>{
    const source=canvasRef.current;if(!source)return;
    const output=document.createElement("canvas");output.width=1200;output.height=800;
    drawFluentCanvas(output,currentModel(),false);
    output.toBlob(blob=>{
      if(!blob){setError("Could not export this canvas as PNG.");return;}
      const url=URL.createObjectURL(blob),a=document.createElement("a");
      a.href=url;a.download=((titleRef.current||"Untitled canvas").trim()||"Untitled canvas").replace(/[\\/:*?"<>|]/g,"_")+".png";
      document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
    },"image/png");
  };
  const exportJSON=()=>{
    const blob=new Blob([JSON.stringify(currentModel(),null,2)],{type:"application/json;charset=utf-8"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=((titleRef.current||"Untitled canvas").trim()||"Untitled canvas").replace(/[\\/:*?"<>|]/g,"_")+".canvas.json";
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  };
  const saveAndBack=async()=>{
    if(record){const saved=!dirtyRef.current||await persist(titleRef.current,currentModel());if(saved)onBack(record.folderId);}
    else onBack(null);
  };
  const copyLink=()=>onCopyLink("canvas",record);
  return <FluentProvider theme={dark?webDarkTheme:webLightTheme}>
    <div className={s.shell+" ff-canvas-page"}>
      <header className={s.header+" ff-canvas-header"}>
        <Button appearance="subtle" icon={<FolderOpen24Regular/>} onClick={saveAndBack}>Back to files</Button>
        <div style={{minWidth:0,display:"grid",gap:2}}>
          <Input className={s.titleInput+" ff-canvas-title"} size="large" value={title} onChange={(_,data)=>{titleRef.current=data.value;setTitle(data.value);markDirty();}} placeholder="Untitled canvas" aria-label="Canvas title"/>
          <Text size={100} className={s.status}>{status}{lastSaved&&status==="Saved on this device"?" · "+lastSaved:""}</Text>
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:8,flexWrap:"wrap"}}>
          <Button appearance="secondary" onClick={copyLink} disabled={!record}>Copy link</Button>
          <Menu><MenuTrigger disableButtonEnhancement><Button appearance="secondary" icon={<ArrowDownload24Regular/>}>Export</Button></MenuTrigger><MenuPopover><MenuList><MenuItem onClick={exportPNG}>Download as PNG</MenuItem><MenuItem onClick={exportJSON}>Download editable canvas JSON</MenuItem></MenuList></MenuPopover></Menu>
          <Button appearance="primary" onClick={()=>persist(titleRef.current,currentModel())} disabled={!ready||!dirty}>Save now</Button>
        </div>
      </header>
      <div className={s.toolbar+" ff-canvas-toolbar"} role="toolbar" aria-label="Canvas tools">
        {[
          ["pen","Pen"],["eraser","Eraser"],["line","Line"],["rect","Rectangle"],["ellipse","Ellipse"],["text","Text"]
        ].map(([value,label])=><Button key={value} size="small" appearance={tool===value?"primary":"subtle"} onClick={()=>setTool(value)}>{label}</Button>)}
        <Divider vertical/>
        <label className="ff-canvas-control">Ink <input type="color" value={color} onChange={event=>setColor(event.target.value)} aria-label="Ink color"/></label>
        <label className="ff-canvas-control">Paper <input type="color" value={background} onChange={event=>changeBackground(event.target.value)} aria-label="Canvas background color"/></label>
        <label className="ff-canvas-control">Size <input type="range" min="1" max="24" value={brushSize} onChange={event=>setBrushSize(Number(event.target.value))} aria-label="Brush size"/><Caption1>{brushSize}px</Caption1></label>
        <Button size="small" appearance={showGrid?"primary":"subtle"} onClick={()=>setShowGrid(value=>!value)}>Grid</Button>
        <Button size="small" appearance="subtle" onClick={undo} disabled={!canUndo}>Undo</Button>
        <Button size="small" appearance="subtle" onClick={redo} disabled={!canRedo}>Redo</Button>
        <Button size="small" appearance="subtle" onClick={clearCanvas}>Clear</Button>
      </div>
      <main className={s.boardArea+" ff-canvas-workarea"}>
        {error&&<div style={{maxWidth:1280,margin:"0 auto 12px"}}><MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar></div>}
        {!ready?<div style={{padding:40,display:"flex",justifyContent:"center"}}><Spinner label={error?"Canvas unavailable":"Loading canvas…"}/></div>:
          <div className={s.board+" ff-canvas-board"}><canvas ref={canvasRef} width={1200} height={800} className={s.canvas+" ff-canvas-surface"} onPointerDown={startDrawing} onPointerMove={continueDrawing} onPointerUp={stopDrawing} onPointerCancel={stopDrawing} aria-label="Drawing canvas" role="img"/></div>}
      </main>
      <footer className={s.footer+" ff-canvas-footer"}><PaintBrush24Regular/><Caption1>FluentFile Canvases · Saved locally in this browser</Caption1><span style={{flex:1}}/><Caption1>{elements.length} item{elements.length===1?"":"s"} · Ctrl/⌘+S saves · Ctrl/⌘+Z undo</Caption1></footer>
    </div>
  </FluentProvider>;
}

function App() {
  const s = useStyles();
  const [files,setFiles] = useState([]);
  const [folders,setFolders] = useState([]);
  const [view,setView] = useState("files");
  const [folderId,setFolderId] = useState(null);
  const [documentId,setDocumentId] = useState(null);
  const [canvasId,setCanvasId] = useState(null);
  const [query,setQuery] = useState("");
  const [sortBy,setSortBy] = useState("modified");
  const [fileFilter,setFileFilter] = useState("all");
  const [selectedIds,setSelectedIds] = useState([]);
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
  const searchRef = useRef(null);
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
  useEffect(()=>{ if(previewUrl) return ()=>URL.revokeObjectURL(previewUrl); },[previewUrl]);
  const toast = message => {setNotice(message);clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setNotice(""),3500);};
  const showPreview = async file => {
    const url=URL.createObjectURL(file.blob);
    setPreviewUrl(url);setPreviewFile(file);setPreviewText("");
    if(kind(file)==="text"){
      try{setPreviewText(file.size>1000000?"This file is too large to preview here. Download it to read the contents.":await file.blob.text());}
      catch{setPreviewText("Could not read this preview.");}
    }
    setDialog("preview");
  };
  const syncRoute = async () => {
    setSelectedIds([]);
    const raw=(window.location.hash||"").startsWith("#/")?window.location.hash.slice(2):"";
    if(!raw)return;
    const parts=raw.split("/").filter(Boolean).map(part=>{try{return decodeURIComponent(part);}catch{return part;}});
    try {
      if((parts[0]==="file"||parts[0]==="doc"||parts[0]==="canvas")&&parts[1]){
        const all=await getAll("files"),file=all.find(item=>item.id===parts[1]);
        if(!file){setView("files");setFolderId(null);setDialog(null);setPreviewFile(null);setPreviewUrl("");setPreviewText("");setDocumentId(null);toast("This file link isn't available in this browser's local storage.");return;}
        setFolderId(file.folderId||null);setQuery("");setDialog(null);setPreviewFile(null);setPreviewUrl("");setPreviewText("");
        if(isDocument(file)){
          if(isDeleted(file)){setView("trash");setDocumentId(null);toast("This document is in the recycle bin. Restore it before editing.");return;}
          if(parts[0]==="canvas"){setView("files");setDocumentId(null);toast("This link does not point to a canvas.");return;}
          setView("doc");setDocumentId(file.id);setCanvasId(null);return;
        }
        if(isCanvas(file)){
          if(isDeleted(file)){setView("trash");setCanvasId(null);toast("This canvas is in the recycle bin. Restore it before editing.");return;}
          if(parts[0]!=="canvas"){setView("files");setCanvasId(null);toast("Open this item from its canvas link.");return;}
          setView("canvas");setCanvasId(file.id);setDocumentId(null);return;
        }
        if(parts[0]==="doc"||parts[0]==="canvas"){setView("files");setDocumentId(null);setCanvasId(null);toast("This link does not point to the expected item type.");return;}
        setDocumentId(null);setCanvasId(null);setView(isDeleted(file)?"trash":"files");await showPreview(file);return;
      }
      if(parts[0]==="folder"&&parts[1]){
        const all=await getAll("folders"),folder=all.find(item=>item.id===parts[1]);
        if(!folder){setView("files");setFolderId(null);setDialog(null);setPreviewFile(null);setPreviewUrl("");setPreviewText("");toast("This folder link is no longer available in this browser.");return;}
        setView("files");setFolderId(folder.id);setQuery("");setDialog(null);setPreviewFile(null);setPreviewUrl("");setPreviewText("");return;
      }
      const next=["files","recent","favorites","trash","docs","canvases"].includes(parts[0])?parts[0]:"files";
      setView(next);setDocumentId(null);setCanvasId(null);setFolderId(null);setQuery("");setDialog(null);setPreviewFile(null);setPreviewUrl("");setPreviewText("");
    } catch(error) { setStorageError(error.message||"Could not open this link."); }
  };
  const setRoute = path => {
    const next="#/"+path;
    if(window.location.hash===next) syncRoute();
    else window.location.hash=next;
  };
  useEffect(()=>{
    const onHashChange=()=>{syncRoute();};
    window.addEventListener("hashchange",onHashChange);
    if(window.location.hash) onHashChange();
    return ()=>window.removeEventListener("hashchange",onHashChange);
  },[]);
  const copyLink = async (type,item) => {
    const path=type==="folder"?"folder/"+encodeURIComponent(item.id):type==="doc"?"doc/"+encodeURIComponent(item.id):type==="canvas"?"canvas/"+encodeURIComponent(item.id):"file/"+encodeURIComponent(item.id);
    const url=window.location.origin+window.location.pathname+"#/"+path;
    try {
      if(navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      else {
        const temp=document.createElement("textarea");temp.value=url;temp.style.position="fixed";temp.style.opacity="0";
        document.body.appendChild(temp);temp.select();const copied=document.execCommand("copy");temp.remove();
        if(!copied)throw new Error("Clipboard permission was denied.");
      }
      toast("Link copied. It opens on this browser profile where the item is stored.");
    } catch { toast("Could not copy the link. Check clipboard permissions."); }
  };
  useEffect(()=>{
    const onKeyDown=event=>{
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){event.preventDefault();searchRef.current?.focus();}
      if((event.ctrlKey||event.metaKey)&&event.shiftKey&&event.key.toLowerCase()==="u"&&view==="files"){event.preventDefault();inputRef.current?.click();}
    };
    window.addEventListener("keydown",onKeyDown);
    return ()=>window.removeEventListener("keydown",onKeyDown);
  },[view]);
  const getFolder = id => folders.find(f=>f.id===id)||null;
  const folderLabel = id => getFolder(id)?.name || "My files";
  const folderPathLabel = id => {
    const parts=[],seen=new Set();let current=id?getFolder(id):null;
    while(current&&!seen.has(current.id)){parts.unshift(current.name);seen.add(current.id);current=current.parentId?getFolder(current.parentId):null;}
    return parts.join(" / ")||"My files";
  };
  const folderDescendants = rootId => {
    const descendants=new Set([rootId]);let changed=true;
    while(changed){changed=false;for(const item of folders){if(item.parentId&&descendants.has(item.parentId)&&!descendants.has(item.id)){descendants.add(item.id);changed=true;}}}
    return descendants;
  };
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
    if(view==="docs"&&!isDocument(f))return false;
    if(view==="canvases"&&!isCanvas(f))return false;
    if(view==="favorites"&&!f.favorite)return false;
    if(view==="files"&&!q&&f.folderId!==folderId)return false;
    return true;
  });
  if(q)shownFiles=shownFiles.filter(f=>f.name.toLocaleLowerCase().includes(q));
  if(fileFilter!=="all")shownFiles=shownFiles.filter(f=>{
    const k=kind(f);
    if(fileFilter==="documents")return ["document","pdf","text"].includes(k);
    if(fileFilter==="other")return k==="file";
    return k===fileFilter;
  });
  if(view==="recent"||sortBy==="modified")shownFiles.sort((a,b)=>b.modifiedAt-a.modifiedAt);
  else if(sortBy==="name")shownFiles.sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:"base"}));
  else if(sortBy==="size")shownFiles.sort((a,b)=>b.size-a.size);
  if(view==="recent")shownFiles=shownFiles.slice(0,50);
  const selectedFiles=files.filter(f=>selectedIds.includes(f.id));
  const allShownSelected=shownFiles.length>0&&shownFiles.every(f=>selectedIds.includes(f.id));
  const toggleSelected=(id,checked)=>setSelectedIds(ids=>checked?Array.from(new Set([...ids,id])):ids.filter(existing=>existing!==id));
  const toggleShownSelection=()=>setSelectedIds(ids=>allShownSelected?ids.filter(id=>!shownFiles.some(f=>f.id===id)):Array.from(new Set([...ids,...shownFiles.map(f=>f.id)])));

  const goView = name => {setSelectedIds([]);setFileFilter("all");setQuery("");setDocumentId(null);setRoute(name);};
  const openEditor = (type,target=null) => {setDialog(type);setDialogTarget(target);setDialogName(target?.name||"");setMoveTarget(type==="move"&&target?.folderId?target.folderId:"root");};
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
  const createDocument = async () => {
    try {
      const html="<p></p>",blob=new Blob([html],{type:DOC_MIME}),now=Date.now();
      const record={id:uid(),name:"Untitled document",type:DOC_MIME,size:blob.size,modifiedAt:now,createdAt:now,folderId:view==="files"?folderId:null,blob,favorite:false,deletedAt:null};
      await write("files",record);await refresh();setDocumentId(record.id);setRoute("doc/"+encodeURIComponent(record.id));
    } catch(error){toast("Could not create document. "+(error.message||"Check browser storage quota."));}
  };
  const createCanvas = async () => {
    try {
      const content={version:1,width:1200,height:800,background:"#ffffff",elements:[]};
      const blob=new Blob([JSON.stringify(content)],{type:CANVAS_MIME}),now=Date.now();
      const record={id:uid(),name:"Untitled canvas",type:CANVAS_MIME,size:blob.size,modifiedAt:now,createdAt:now,folderId:view==="files"?folderId:null,blob,favorite:false,deletedAt:null};
      await write("files",record);await refresh();setCanvasId(record.id);setRoute("canvas/"+encodeURIComponent(record.id));
    } catch(error){toast("Could not create canvas. "+(error.message||"Check browser storage quota."));}
  };
  const download = async file => {
    try{
      const blob=isDocument(file)?new Blob([fullDocumentHtml(file.name,await file.blob.text())],{type:"text/html;charset=utf-8"}):file.blob;
      const url=URL.createObjectURL(blob),a=document.createElement("a");
      a.href=url;a.download=isDocument(file)?(file.name.toLowerCase().endsWith(".html")?file.name:file.name+".html"):isCanvas(file)?(file.name.replace(/[\\/:*?"<>|]/g,"_")+".canvas.json"):file.name;
      document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
    }catch(error){toast("Could not download file. "+(error.message||"Try again."));}
  };
  const preview = async file => {
    const next="#/"+(isDocument(file)?"doc/":isCanvas(file)?"canvas/":"file/")+encodeURIComponent(file.id);
    if(window.location.hash===next) await syncRoute();
    else window.location.hash=next;
  };
  const closePreview = () => {
    setPreviewUrl("");setPreviewFile(null);setPreviewText("");setDialog(null);
    const back=isDeleted(previewFile)?"trash":previewFile?.folderId?"folder/"+encodeURIComponent(previewFile.folderId):"files";
    setRoute(back);
  };
  const moveFolder = async () => {
    if(!dialogTarget)return;
    if(moveTarget!=="root"&&folderDescendants(dialogTarget.id).has(moveTarget)){toast("A folder cannot be moved inside itself or one of its subfolders.");return;}
    try {
      await write("folders",{...dialogTarget,parentId:moveTarget==="root"?null:moveTarget});
      closeDialog();await refresh();toast("Folder moved.");
    } catch(error){toast(error.message||"Could not move folder.");}
  };
  const deleteEmptyFolder = async folder => {
    const hasFiles=files.some(file=>file.folderId===folder.id);
    const hasFolders=folders.some(child=>child.parentId===folder.id);
    if(hasFiles||hasFolders){toast("This folder isn't empty. Move or remove its contents before deleting it.");return;}
    if(!window.confirm('Delete empty folder "'+folder.name+'"?'))return;
    try {
      await remove("folders",folder.id);
      if(folderId===folder.id)setRoute(folder.parentId?"folder/"+encodeURIComponent(folder.parentId):"files");
      await refresh();toast("Folder deleted.");
    } catch(error){toast(error.message||"Could not delete folder.");}
  };
  const action = async (name,file) => {
    try {
      if(name==="duplicate"){
        const used=new Set(files.filter(f=>f.folderId===file.folderId&&!isDeleted(f)).map(f=>f.name.toLocaleLowerCase()));
        let newName="Copy of "+file.name,index=2;
        while(used.has(newName.toLocaleLowerCase())){newName="Copy ("+index+") of "+file.name;index++;}
        await write("files",{...file,id:uid(),name:newName,createdAt:Date.now(),modifiedAt:Date.now(),favorite:false,deletedAt:null});
        await refresh();toast("Created a copy of "+file.name+".");
      }
      if(name==="favorite"){await write("files",{...file,favorite:!file.favorite});await refresh();if(previewFile?.id===file.id)setPreviewFile({...file,favorite:!file.favorite});toast(file.favorite?"Removed from favorites.":"Added to favorites.");}
      if(name==="download")download(file);
      if(name==="preview")preview(file);
      if(name==="trash"){await write("files",{...file,deletedAt:Date.now()});setSelectedIds(ids=>ids.filter(id=>id!==file.id));await refresh();toast("Moved to recycle bin.");}
      if(name==="restore"){await write("files",{...file,deletedAt:null});setSelectedIds(ids=>ids.filter(id=>id!==file.id));await refresh();toast("File restored.");}
      if(name==="delete"&&window.confirm('Permanently delete "'+file.name+'"? This cannot be undone.')){await remove("files",file.id);setSelectedIds(ids=>ids.filter(id=>id!==file.id));await refresh();toast("File permanently deleted.");}
      if(name==="rename")openEditor("rename-file",file);
      if(name==="move")openEditor("move",file);
      if(name==="move-folder")openEditor("move-folder",file);
      if(name==="delete-folder")await deleteEmptyFolder(file);
    } catch(e){toast(e.message||"The action could not be completed.");}
  };
  const downloadFolderZip = async folder => {
    try {
      const JSZip=(await import("jszip")).default,zip=new JSZip();
      const descendants=new Set([folder.id]);let changed=true;
      while(changed){changed=false;for(const item of folders){if(item.parentId&&descendants.has(item.parentId)&&!descendants.has(item.id)){descendants.add(item.id);changed=true;}}}
      const getPath=id=>{const parts=[],pathSeen=new Set();let current=id?getFolder(id):null;while(current&&!pathSeen.has(current.id)){parts.unshift(current.name);pathSeen.add(current.id);current=current.parentId?getFolder(current.parentId):null;}return parts;};
      folders.filter(f=>descendants.has(f.id)).forEach(f=>zip.folder(getPath(f.id).join("/")));
      const contained=liveFiles.filter(file=>descendants.has(file.folderId));
      const archivePath=file=>getPath(file.folderId).concat(isDocument(file)&&!file.name.toLowerCase().endsWith(".html")?file.name+".html":file.name).join("/");
      contained.forEach(file=>zip.file(archivePath(file),file.blob));
      zip.file("_fluentfile-manifest.json",JSON.stringify({version:1,files:contained.map(file=>({path:archivePath(file),name:file.name,type:file.type,favorite:!!file.favorite,createdAt:file.createdAt,modifiedAt:file.modifiedAt,isDocument:isDocument(file)}))},null,2));
      const blob=await zip.generateAsync({type:"blob"}),url=URL.createObjectURL(blob),a=document.createElement("a");
      a.href=url;a.download=folder.name.replace(/[\\/:*?"<>|]/g,"_")+".zip";a.click();setTimeout(()=>URL.revokeObjectURL(url),1200);
      toast("Folder ZIP prepared ("+contained.length+" files).");
    } catch(error){toast("Could not create folder ZIP. "+(error.message||"Try again."));}
  };
  const backup = async () => {
    try {
      const JSZip=(await import("jszip")).default,zip=new JSZip(),root=zip.folder("FluentFile backup");
      const pathFor = id => {const parts=[],pathSeen=new Set();let f=id?getFolder(id):null;while(f&&!pathSeen.has(f.id)){parts.unshift(f.name);pathSeen.add(f.id);f=f.parentId?getFolder(f.parentId):null;}return parts;};
      const archivePath = file => pathFor(file.folderId).concat(isDocument(file)&&!file.name.toLowerCase().endsWith(".html")?file.name+".html":file.name).join("/");
      liveFiles.forEach(file=>root.file(archivePath(file),file.blob));
      root.file("_fluentfile-manifest.json",JSON.stringify({version:1,folders,files:liveFiles.map(file=>({path:archivePath(file),name:file.name,type:file.type,favorite:!!file.favorite,createdAt:file.createdAt,modifiedAt:file.modifiedAt,isDocument:isDocument(file)})),createdAt:new Date().toISOString()},null,2));
      const blob=await zip.generateAsync({type:"blob"}),url=URL.createObjectURL(blob),a=document.createElement("a");
      a.href=url;a.download="FluentFile-backup.zip";a.click();setTimeout(()=>URL.revokeObjectURL(url),1200);toast("ZIP backup created.");
    } catch(e){toast("Could not create backup. "+(e.message||"Try again."));}
  };
  const restoreZip = async zipFile => {
    try {
      const JSZip=(await import("jszip")).default,zip=await JSZip.loadAsync(zipFile);
      const allKeys=Object.keys(zip.files);
      const manifestKey=allKeys.find(key=>key.endsWith("_fluentfile-manifest.json"));
      let manifest=null,prefix="";
      if(manifestKey){
        try{manifest=JSON.parse(await zip.files[manifestKey].async("string"));prefix=manifestKey.slice(0,manifestKey.lastIndexOf("/")+1);}
        catch{manifest=null;prefix="";}
      }
      const entries=allKeys.filter(key=>!zip.files[key].dir&&!key.endsWith("_fluentfile-manifest.json"));let count=0;
      for(const key of entries){
        const item=zip.files[key];
        const relativePath=prefix&&key.startsWith(prefix)?key.slice(prefix.length):key;
        const metadata=manifest?.files?.find(entry=>entry.path===relativePath);
        const archivedName=relativePath.split("/").pop();
        const name=metadata?.name||archivedName;
        if(!name)continue;
        const type=metadata?.type||(metadata?.isDocument?DOC_MIME:mimeFor(name));
        const raw=await item.async("uint8array"),blob=new Blob([raw],{type});
        const parts=relativePath.split("/").slice(0,-1);let parentId=null;
        for(const part of parts){let all=await getAll("folders"),folder=all.find(f=>f.parentId===parentId&&f.name===part);
          if(!folder){folder={id:uid(),name:part,parentId,createdAt:Date.now()};await write("folders",folder);}parentId=folder.id;
        }
        await write("files",{id:uid(),name,type,size:blob.size,modifiedAt:metadata?.modifiedAt||Date.now(),createdAt:metadata?.createdAt||Date.now(),folderId:parentId,blob,favorite:!!metadata?.favorite,deletedAt:null});count++;
      }
      await refresh();toast("Restored "+count+" file"+(count===1?"":"s")+" from backup.");
    } catch(e){toast("Could not restore this ZIP backup. "+(e.message||""));}
  };
  const fileCard = f => <FileCard key={f.id} file={f} layout={layout} styles={s} onAction={action} onPreview={preview} onCopyLink={copyLink} selected={selectedIds.includes(f.id)} onSelect={toggleSelected}/>;
  if(view==="doc") return <FluentDocEditor key={documentId} fileId={documentId} dark={dark} onBack={parentId=>setRoute(parentId?"folder/"+encodeURIComponent(parentId):"files")} onCopyLink={copyLink} onSaved={refresh}/>;
  if(view==="canvas") return <FluentCanvasEditor key={canvasId} fileId={canvasId} dark={dark} onBack={parentId=>setRoute(parentId?"folder/"+encodeURIComponent(parentId):"canvases")} onCopyLink={copyLink} onSaved={refresh}/>;
  const bulkAction = async mode => {
    const targets=selectedFiles;
    if(!targets.length)return;
    try {
      if(mode==="trash"){
        for(const file of targets.filter(f=>!isDeleted(f)))await write("files",{...file,deletedAt:Date.now()});
        toast("Moved "+targets.length+" file(s) to the recycle bin.");
      } else if(mode==="restore"){
        for(const file of targets.filter(isDeleted))await write("files",{...file,deletedAt:null});
        toast("Restored "+targets.length+" file(s).");
      } else if(mode==="delete"){
        if(!window.confirm("Permanently delete "+targets.length+" selected file(s)? This cannot be undone."))return;
        for(const file of targets)await remove("files",file.id);
        toast("Permanently deleted "+targets.length+" file(s).");
      } else if(mode==="favorite"){
        for(const file of targets.filter(f=>!isDeleted(f)))await write("files",{...file,favorite:true});
        toast("Added selected file(s) to favorites.");
      } else if(mode==="download"){
        const JSZip=(await import("jszip")).default,zip=new JSZip();
        const pathFor=id=>{const parts=[],seen=new Set();let folder=id?getFolder(id):null;while(folder&&!seen.has(folder.id)){parts.unshift(folder.name);seen.add(folder.id);folder=folder.parentId?getFolder(folder.parentId):null;}return parts;};
        const archived=targets.filter(f=>!isDeleted(f));
        const archivePath=file=>pathFor(file.folderId).concat(isDocument(file)&&!file.name.toLowerCase().endsWith(".html")?file.name+".html":file.name).join("/");
        archived.forEach(file=>zip.file(archivePath(file),file.blob));
        zip.file("_fluentfile-manifest.json",JSON.stringify({version:1,files:archived.map(file=>({path:archivePath(file),name:file.name,type:file.type,favorite:!!file.favorite,createdAt:file.createdAt,modifiedAt:file.modifiedAt,isDocument:isDocument(file)}))},null,2));
        const blob=await zip.generateAsync({type:"blob"}),url=URL.createObjectURL(blob),a=document.createElement("a");
        a.href=url;a.download="FluentFile-selected-files.zip";a.click();setTimeout(()=>URL.revokeObjectURL(url),1200);
        toast("ZIP containing selected files is ready.");
      }
      setSelectedIds([]);await refresh();
    } catch(error){toast(error.message||"The bulk action could not be completed.");}
  };
  const moveFolderOptions = (() => {
    const blocked=dialog==="move-folder"&&dialogTarget?folderDescendants(dialogTarget.id):new Set();
    return folders.filter(folder=>!blocked.has(folder.id));
  })();
  const title = view==="trash"?"Recycle bin":view==="favorites"?"Favorites":view==="recent"?"Recent":view==="docs"?"FluentFile Docs":view==="canvases"?"FluentFile Canvases":folderLabel(folderId);
  const subtitle = view==="trash"?"Restore deleted files or permanently remove them.":view==="favorites"?"Your starred files in one place.":view==="recent"?"Your most recently changed files.":view==="docs"?"Create, edit, and organize your documents alongside your files.":view==="canvases"?"Draw, sketch, and export artwork from your browser.":"Organize files and folders stored in this browser.";

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
          <Button className={s.navButton+" ff-nav-button "+(view==="docs"?s.navActive:"")} appearance="subtle" icon={<Document24Regular/>} onClick={()=>goView("docs")}><span className="ff-nav-text">Docs</span></Button>
          <Button className={s.navButton+" ff-nav-button "+(view==="canvases"?s.navActive:"")} appearance="subtle" icon={<PaintBrush24Regular/>} onClick={()=>goView("canvases")}><span className="ff-nav-text">Canvases</span></Button>
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
          <SearchBox ref={searchRef} className={s.search} placeholder="Search files and folders (Ctrl+K)" value={query} onChange={(_,data)=>{setSelectedIds([]);setQuery(data.value);}}/>
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
            {(view==="files"||view==="docs"||view==="canvases")&&<div className={s.actions}>
              {(view==="files"||view==="docs")&&<Button appearance="secondary" icon={<Document24Regular/>} onClick={createDocument}>New document</Button>}
              {(view==="files"||view==="canvases")&&<Button appearance="secondary" icon={<PaintBrush24Regular/>} onClick={createCanvas}>New canvas</Button>}
              {view==="files"&&<><Button appearance="secondary" icon={<FolderAdd24Regular/>} onClick={()=>openEditor("new-folder")}>New folder</Button><Button appearance="primary" icon={<ArrowUpload24Regular/>} onClick={()=>inputRef.current?.click()}>Upload files</Button><input ref={inputRef} type="file" multiple hidden onChange={e=>{addFiles(e.target.files);e.target.value="";}}/></>}
            </div>}
          </div>
          {view==="files"&&<div className={s.dropzone+" "+(dragging?s.dropDrag:"")} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);addFiles(e.dataTransfer.files);}}>
            <div className={s.dropMark}><ArrowUpload24Regular fontSize={22}/></div><div className={s.dropCopy+" ff-drop-copy"}><Text weight="semibold">Drop files here</Text><Caption1>or use Upload files. Everything stays in this browser.</Caption1></div><Button appearance="subtle" onClick={()=>inputRef.current?.click()}>Browse files</Button>
          </div>}
          {view==="files"&&<div className={s.breadcrumbs}><Button size="small" appearance="subtle" onClick={()=>{setQuery("");setRoute("files");}}>My files</Button>{folderPath.map(f=><React.Fragment key={f.id}><ChevronRight12Regular/><Button size="small" appearance="subtle" onClick={()=>{setQuery("");setRoute("folder/"+encodeURIComponent(f.id));}}>{f.name}</Button></React.Fragment>)}</div>}
          <div className={s.contentBar}><Text size={200}>{shownFolders.length} folder{shownFolders.length===1?"":"s"} · {shownFiles.length} file{shownFiles.length===1?"":"s"}</Text><div className={s.controls}>
            <Dropdown size="small" value={fileFilter==="all"?"All types":fileFilter==="image"?"Images":fileFilter==="documents"?"Documents":fileFilter==="video"?"Videos":fileFilter==="audio"?"Audio":"Other files"} selectedOptions={[fileFilter]} onOptionSelect={(_,data)=>{setSelectedIds([]);setFileFilter(data.optionValue||"all");}} aria-label="Filter by file type"><Option value="all">All types</Option><Option value="image">Images</Option><Option value="documents">Documents</Option><Option value="video">Videos</Option><Option value="audio">Audio</Option><Option value="other">Other files</Option></Dropdown>
            <Dropdown size="small" value={sortBy==="modified"?"Last modified":sortBy==="name"?"Name":"Size"} selectedOptions={[sortBy]} onOptionSelect={(_,data)=>setSortBy(data.optionValue||"modified")} aria-label="Sort files"><Option value="modified">Last modified</Option><Option value="name">Name</Option><Option value="size">Size</Option></Dropdown>
            <Toolbar aria-label="Display options"><ToolbarButton title="Grid view" aria-label="Grid view" icon={<Grid24Regular/>} appearance={layout==="grid"?"primary":"subtle"} onClick={()=>setLayout("grid")}/><ToolbarButton title="List view" aria-label="List view" icon={<AppsList24Regular/>} appearance={layout==="list"?"primary":"subtle"} onClick={()=>setLayout("list")}/></Toolbar>
          </div></div>
          {selectedIds.length>0&&<div className={s.contentBar}>
            <Checkbox checked={allShownSelected} onChange={toggleShownSelection} label={"Select all visible ("+shownFiles.length+")"}/>
            <Text weight="semibold" size={200}>{selectedFiles.length} selected</Text>
            <div className={s.controls}>
              {view==="trash"?<>
                <Button size="small" appearance="secondary" icon={<ArrowUndo24Regular/>} onClick={()=>bulkAction("restore")}>Restore</Button>
                <Button size="small" appearance="secondary" icon={<Delete24Regular/>} onClick={()=>bulkAction("delete")}>Delete permanently</Button>
              </>:<>
                <Button size="small" appearance="secondary" icon={<Star24Regular/>} onClick={()=>bulkAction("favorite")}>Favorite</Button>
                <Button size="small" appearance="secondary" icon={<ArrowDownload24Regular/>} onClick={()=>bulkAction("download")}>Download ZIP</Button>
                <Button size="small" appearance="secondary" icon={<Delete24Regular/>} onClick={()=>bulkAction("trash")}>Move to recycle bin</Button>
              </>}
              <Button size="small" appearance="subtle" icon={<Dismiss24Regular/>} onClick={()=>setSelectedIds([])}>Clear selection</Button>
            </div>
          </div>}
          {loading?<div className={s.empty}><Spinner label="Loading your files…"/></div>:<>
            <div className={s.sections}>
              {shownFolders.length>0&&<section className={s.section}><Title3 className={s.sectionTitle}>Folders</Title3><div className={s.folderGrid}>{shownFolders.map(folder=><Card key={folder.id} className={s.folderCard}>
                <div className={s.folderMark}><Folder24Regular fontSize={24}/></div><Button appearance="subtle" className={s.itemInfo} onClick={()=>setRoute("folder/"+encodeURIComponent(folder.id))}><Text weight="semibold" className={s.itemName}>{folder.name}</Text><Caption1>Folder · Open folder link</Caption1></Button>
                <Menu><MenuTrigger disableButtonEnhancement><Button appearance="subtle" icon={<MoreHorizontal24Regular/>} aria-label={"Options for "+folder.name}/></MenuTrigger><MenuPopover><MenuList><MenuItem icon={<FolderOpen24Regular/>} onClick={()=>setRoute("folder/"+encodeURIComponent(folder.id))}>Open</MenuItem><MenuItem onClick={()=>copyLink("folder",folder)}>Copy folder link</MenuItem><MenuItem onClick={()=>downloadFolderZip(folder)}>Download folder as ZIP</MenuItem><MenuItem icon={<ArrowMove24Regular/>} onClick={()=>openEditor("move-folder",folder)}>Move folder</MenuItem><MenuItem icon={<Rename24Regular/>} onClick={()=>openEditor("rename-folder",folder)}>Rename</MenuItem><MenuItem icon={<Delete24Regular/>} onClick={()=>action("delete-folder",folder)}>Delete empty folder</MenuItem></MenuList></MenuPopover></Menu>
              </Card>)}</div></section>}
              {shownFiles.length>0&&<section className={s.section}><Title3 className={s.sectionTitle}>{view==="trash"?"Deleted files":shownFolders.length?"Files":"All files"}</Title3><div className={(layout==="list"?s.fileGrid+" "+s.fileGridList:s.fileGrid)+" ff-file-grid"}>{shownFiles.map(fileCard)}</div></section>}
            </div>
            {!shownFolders.length&&!shownFiles.length&&<div className={s.empty}><div className={s.emptyMark}>{view==="trash"?<Delete24Regular fontSize={30}/>:view==="favorites"?<Star24Regular fontSize={30/>:view==="canvases"?<PaintBrush24Regular fontSize={30}/>:<FolderOpen24Regular fontSize={30}/>}</div>
              <Title3>{query?"No matches found":view==="trash"?"Recycle bin is empty":view==="favorites"?"No favorites yet":view==="recent"?"No recent files":view==="docs"?"No documents yet":view==="canvases"?"No canvases yet":"Start with your first file"}</Title3>
              <Body1>{query?"Try another search or clear the search box.":view==="trash"?"Deleted files appear here so you can restore them.":view==="favorites"?"Use the star action on a file to keep it here.":view==="recent"?"Recently changed files will appear here.":view==="docs"?"Create your first document in FluentFile Docs.":view==="canvases"?"Create a blank canvas and start drawing, sketching, or planning.":"Upload files from your device or create a folder to stay organized."}</Body1>
              {view==="docs"&&!query&&<Button appearance="primary" icon={<Document24Regular/>} onClick={createDocument}>Create document</Button>}
              {view==="canvases"&&!query&&<Button appearance="primary" icon={<PaintBrush24Regular/>} onClick={createCanvas}>Create canvas</Button>}
              {view==="files"&&!query&&<div className={s.actions}><Button appearance="primary" icon={<ArrowUpload24Regular/>} onClick={()=>inputRef.current?.click()}>Upload files</Button><Button appearance="secondary" icon={<FolderAdd24Regular/>} onClick={()=>openEditor("new-folder")}>Create folder</Button><Button appearance="secondary" icon={<Document24Regular/>} onClick={createDocument}>Create document</Button><Button appearance="secondary" icon={<PaintBrush24Regular/>} onClick={createCanvas}>Create canvas</Button></div>}
              {query&&<Button appearance="secondary" onClick={()=>setQuery("")}>Clear search</Button>}
            </div>}
          </>}
          <div className={s.bottomNote}><ShieldCheckmark24Regular/><Caption1>Saved automatically to this browser</Caption1></div>
        </div>
      </main>
    </div>

    {dialog&&dialog!=="preview"&&<Dialog open onOpenChange={(_,data)=>{if(!data.open)closeDialog();}}>
      <DialogSurface><DialogBody><DialogTitle>{dialog==="new-folder"?"Create a folder":dialog==="rename-folder"?"Rename folder":dialog==="rename-file"?"Rename file":dialog==="move-folder"?"Move folder":"Move file"}</DialogTitle>
        <DialogContent>
          {(dialog==="new-folder"||dialog==="rename-folder"||dialog==="rename-file")&&<Field label={dialog==="new-folder"?"Folder name":"Name"} required><Input autoFocus value={dialogName} onChange={(_,data)=>setDialogName(data.value)} onKeyDown={e=>{if(e.key==="Enter")(dialog==="new-folder"?createFolder():rename());}}/></Field>}
          {(dialog==="move"||dialog==="move-folder")&&<Field label="Destination folder"><Dropdown value={moveTarget==="root"?"My files (root)":folderLabel(moveTarget)} selectedOptions={[moveTarget]} onOptionSelect={(_,data)=>setMoveTarget(data.optionValue||"root")}><Option value="root">My files (root)</Option>{(dialog==="move-folder"?moveFolderOptions:folders).map(f=><Option key={f.id} value={f.id}>{folderPathLabel(f.id)}</Option>)}</Dropdown><Caption1>{dialog==="move-folder"?"Choose a new parent folder. Moving into this folder or a descendant is not allowed.":"Files remain in this browser; only their folder changes."}</Caption1></Field>}
        </DialogContent>
        <DialogActions><Button appearance="secondary" onClick={closeDialog}>Cancel</Button><Button appearance="primary" disabled={dialog!=="move"&&!dialogName.trim()} onClick={dialog==="new-folder"?createFolder:dialog==="move"?async()=>{const dest=moveTarget==="root"?null:getFolder(moveTarget);await write("files",{...dialogTarget,folderId:dest?.id||null,modifiedAt:Date.now()});closeDialog();await refresh();toast("File moved.");}:dialog==="move-folder"?moveFolder:rename}>{dialog==="new-folder"?"Create":dialog==="move"||dialog==="move-folder"?"Move":"Save"}</Button></DialogActions>
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
      </DialogContent><DialogActions><Button appearance="secondary" onClick={()=>copyLink("file",previewFile)}>Copy file link</Button><Button appearance="secondary" icon={<Star24Regular/>} onClick={()=>action("favorite",previewFile)}>{previewFile.favorite?"Remove favorite":"Add to favorites"}</Button><Button appearance="secondary" onClick={closePreview}>Close</Button><Button appearance="primary" icon={<ArrowDownload24Regular/>} onClick={()=>download(previewFile)}>Download</Button></DialogActions>
    </DialogBody></DialogSurface></Dialog>}
    {notice&&<div className={s.toast} role="status"><Text>{notice}</Text><Button appearance="subtle" size="small" icon={<Dismiss24Regular/>} aria-label="Dismiss notification" onClick={()=>setNotice("")}/></div>}
  </FluentProvider>;
}
export default App;
