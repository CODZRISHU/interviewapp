import json
from typing import Any, Dict, Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, Request, status
from fastapi.responses import HTMLResponse
from bson import ObjectId

from db import database
from utils.helpers import utc_now


router = APIRouter(tags=["mongo-ui"])


def _serialize_bson(val: Any) -> Any:
    if isinstance(val, ObjectId):
        return str(val)
    if isinstance(val, datetime):
        return val.isoformat()
    if isinstance(val, dict):
        return {k: _serialize_bson(v) for k, v in val.items()}
    if isinstance(val, list):
        return [_serialize_bson(v) for v in val]
    return val


@router.get("/api/db/collections")
async def list_collections():
    cols = await database.list_collection_names()
    result = []
    for c in sorted(cols):
        count = await database[c].count_documents({})
        result.append({"name": c, "count": count})
    return {"collections": result}


@router.get("/api/db/collections/{collection_name}/documents")
async def get_collection_documents(
    collection_name: str,
    search: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    skip: int = Query(default=0, ge=0),
):
    col = database[collection_name]
    query = {}
    if search and search.strip():
        search_term = search.strip()
        query = {
            "$or": [
                {"id": {"$regex": search_term, "$options": "i"}},
                {"email": {"$regex": search_term, "$options": "i"}},
                {"name": {"$regex": search_term, "$options": "i"}},
                {"planKey": {"$regex": search_term, "$options": "i"}},
                {"billingStatus": {"$regex": search_term, "$options": "i"}},
                {"invoiceNumber": {"$regex": search_term, "$options": "i"}},
                {"status": {"$regex": search_term, "$options": "i"}},
            ]
        }

    total = await col.count_documents(query)
    cursor = col.find(query).sort("_id", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(limit)

    serialized_docs = [_serialize_bson(d) for d in docs]
    return {
        "collection": collection_name,
        "total": total,
        "skip": skip,
        "limit": limit,
        "documents": serialized_docs,
    }


@router.put("/api/db/collections/{collection_name}/documents/{doc_id}")
async def update_document(collection_name: str, doc_id: str, request: Request):
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body.")

    col = database[collection_name]
    query = {"$or": [{"id": doc_id}, {"_id": doc_id}]}
    if ObjectId.is_valid(doc_id):
        query["$or"].append({"_id": ObjectId(doc_id)})

    existing = await col.find_one(query)
    if not existing:
        raise HTTPException(status_code=404, detail="Document not found.")

    body.pop("_id", None)
    await col.update_one({"_id": existing["_id"]}, {"$set": body})

    updated = await col.find_one({"_id": existing["_id"]})
    return {"message": "Document updated successfully.", "document": _serialize_bson(updated)}


@router.delete("/api/db/collections/{collection_name}/documents/{doc_id}")
async def delete_document(collection_name: str, doc_id: str):
    col = database[collection_name]
    query = {"$or": [{"id": doc_id}, {"_id": doc_id}]}
    if ObjectId.is_valid(doc_id):
        query["$or"].append({"_id": ObjectId(doc_id)})

    res = await col.delete_one(query)
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found.")
    return {"message": "Document deleted successfully."}


@router.get("/mongo-ui", response_class=HTMLResponse)
async def mongo_ui_html():
    html_content = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MongoDB Local Web Manager — Kevin AI</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: 'Outfit', sans-serif; background-color: #050505; color: #fff; }
    pre, code, textarea { font-family: 'JetBrains Mono', monospace; }
    .glass-card { background: rgba(18, 18, 22, 0.7); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.1); }
    .custom-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
    .custom-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 4px; }
  </style>
</head>
<body class="min-h-screen flex flex-col">
  <!-- Top Navigation Header -->
  <header class="h-16 border-b border-white/10 glass-card px-6 flex items-center justify-between shrink-0">
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded-xl bg-[#E50914] flex items-center justify-center font-extrabold text-white text-sm shadow-[0_0_15px_rgba(229,9,20,0.5)]">
        🍃
      </div>
      <div>
        <h1 class="font-extrabold text-base tracking-wide text-white">MongoDB Local Web Manager</h1>
        <p class="text-[11px] text-gray-400 font-mono">URI: mongodb://localhost:27017 | DB: kevin_ai_dev</p>
      </div>
    </div>
    <div class="flex items-center gap-4 text-xs">
      <span class="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Connected
      </span>
    </div>
  </header>

  <!-- Main Grid Layout -->
  <div class="flex-1 flex overflow-hidden">
    <!-- Left Sidebar: Collections -->
    <aside class="w-64 border-r border-white/10 glass-card flex flex-col shrink-0">
      <div class="p-4 border-b border-white/10 flex items-center justify-between">
        <span class="text-xs font-bold uppercase tracking-wider text-gray-400">Collections</span>
        <button onclick="loadCollections()" class="text-xs text-[#E50914] hover:underline font-semibold">Refresh</button>
      </div>
      <div id="collections-list" class="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scroll">
        <div class="text-xs text-gray-500 p-2">Loading collections...</div>
      </div>
    </aside>

    <!-- Content Area -->
    <main class="flex-1 flex flex-col min-w-0 bg-[#09090c]">
      <!-- Search & Controls Header -->
      <div class="p-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card shrink-0">
        <div class="flex items-center gap-3 flex-1 max-w-xl">
          <input
            id="search-input"
            type="text"
            placeholder="Search ID, email, status..."
            onkeydown="if(event.key==='Enter') searchDocs()"
            class="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-white/15 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#E50914]"
          />
          <button onclick="searchDocs()" class="px-5 py-2.5 rounded-xl bg-[#E50914] hover:bg-[#b80710] font-bold text-xs shadow-md transition">
            Search
          </button>
        </div>
        <div class="text-xs text-gray-400 flex items-center gap-3">
          <span id="doc-count-badge">0 Documents</span>
        </div>
      </div>

      <!-- Document List / Viewer -->
      <div id="documents-container" class="flex-1 overflow-y-auto p-6 space-y-4 custom-scroll">
        <div class="text-center py-20 text-gray-500 text-sm">Select a collection from the sidebar to inspect documents.</div>
      </div>
    </main>
  </div>

  <!-- Edit Document Modal -->
  <div id="edit-modal" class="fixed inset-0 bg-black/80 backdrop-blur-sm hidden items-center justify-center p-4 z-50">
    <div class="glass-card rounded-3xl max-w-3xl w-full p-6 space-y-4 border border-white/15 shadow-2xl">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold text-white">Edit Document JSON</h3>
        <button onclick="closeEditModal()" class="text-gray-400 hover:text-white text-lg font-bold">✕</button>
      </div>
      <textarea
        id="json-editor"
        rows="18"
        class="w-full p-4 rounded-2xl bg-black/80 border border-white/15 text-xs text-emerald-300 custom-scroll focus:outline-none focus:border-[#E50914]"
      ></textarea>
      <div class="flex justify-end gap-3">
        <button onclick="closeEditModal()" class="px-5 py-2.5 rounded-xl bg-white/10 text-gray-300 font-bold text-xs hover:bg-white/20">Cancel</button>
        <button onclick="saveDocumentEdit()" class="px-6 py-2.5 rounded-xl bg-[#E50914] text-white font-bold text-xs shadow-lg hover:bg-[#b80710]">Save Changes</button>
      </div>
    </div>
  </div>

  <script>
    let activeCollection = null;
    let editingDocId = null;

    async function loadCollections() {
      const res = await fetch('/api/db/collections');
      const data = await res.json();
      const listEl = document.getElementById('collections-list');
      listEl.innerHTML = '';
      data.collections.forEach(c => {
        const btn = document.createElement('button');
        btn.className = `w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-center justify-between transition ${activeCollection === c.name ? 'bg-[#E50914]/20 border border-[#E50914]/40 text-white font-bold' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`;
        btn.onclick = () => selectCollection(c.name);
        btn.innerHTML = `<span>📂 ${c.name}</span><span class="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-mono">${c.count}</span>`;
        listEl.appendChild(btn);
      });
      if (!activeCollection && data.collections.length > 0) {
        selectCollection(data.collections[0].name);
      }
    }

    async function selectCollection(name) {
      activeCollection = name;
      document.getElementById('search-input').value = '';
      loadCollections();
      loadDocuments();
    }

    async function loadDocuments(query = '') {
      if (!activeCollection) return;
      const container = document.getElementById('documents-container');
      container.innerHTML = '<div class="text-center py-10 text-xs text-gray-500">Loading documents...</div>';

      const url = `/api/db/collections/${activeCollection}/documents?search=${encodeURIComponent(query)}`;
      const res = await fetch(url);
      const data = await res.json();

      document.getElementById('doc-count-badge').innerText = `${data.total} Documents in '${activeCollection}'`;
      container.innerHTML = '';

      if (data.documents.length === 0) {
        container.innerHTML = '<div class="text-center py-20 text-gray-500 text-sm">No documents found.</div>';
        return;
      }

      data.documents.forEach((doc, idx) => {
        const docId = doc.id || doc._id;
        const card = document.createElement('div');
        card.className = 'glass-card rounded-2xl p-5 border border-white/10 relative space-y-3';
        card.innerHTML = `
          <div class="flex items-center justify-between border-b border-white/10 pb-3">
            <span class="text-xs font-bold text-gray-300 font-mono">ID: ${docId}</span>
            <div class="flex items-center gap-2">
              <button onclick='openEditModal(${JSON.stringify(doc)})' class="px-3 py-1 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-bold hover:bg-blue-500/30">Edit JSON</button>
              <button onclick='deleteDoc("${docId}")' class="px-3 py-1 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-bold hover:bg-red-500/30">Delete</button>
            </div>
          </div>
          <pre class="text-xs text-emerald-300 bg-black/60 p-4 rounded-xl overflow-x-auto custom-scroll">${JSON.stringify(doc, null, 2)}</pre>
        `;
        container.appendChild(card);
      });
    }

    function searchDocs() {
      const q = document.getElementById('search-input').value;
      loadDocuments(q);
    }

    function openEditModal(doc) {
      editingDocId = doc.id || doc._id;
      document.getElementById('json-editor').value = JSON.stringify(doc, null, 2);
      document.getElementById('edit-modal').classList.remove('hidden');
      document.getElementById('edit-modal').classList.add('flex');
    }

    function closeEditModal() {
      document.getElementById('edit-modal').classList.add('hidden');
      document.getElementById('edit-modal').classList.remove('flex');
    }

    async function saveDocumentEdit() {
      try {
        const jsonText = document.getElementById('json-editor').value;
        const parsed = JSON.parse(jsonText);
        const res = await fetch(`/api/db/collections/${activeCollection}/documents/${editingDocId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed)
        });
        if (res.ok) {
          alert('Document updated successfully!');
          closeEditModal();
          loadDocuments();
        } else {
          const err = await res.json();
          alert(err.detail || 'Update failed.');
        }
      } catch (e) {
        alert('Invalid JSON formatting: ' + e.message);
      }
    }

    async function deleteDoc(docId) {
      if (!confirm(`Are you sure you want to delete document ${docId}?`)) return;
      const res = await fetch(`/api/db/collections/${activeCollection}/documents/${docId}`, { method: 'DELETE' });
      if (res.ok) {
        loadCollections();
        loadDocuments();
      } else {
        alert('Delete failed.');
      }
    }

    loadCollections();
  </script>
</body>
</html>"""
    return html_content
