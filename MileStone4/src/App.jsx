import { useState, useEffect, useRef, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts";

// ─── API CONFIG ───────────────────────────────────────────────────────────────
const API_BASE = "http://localhost:8000";

// Central fetch helper — attaches JWT token to every request automatically
// Similar to Python's requests.Session() with auth headers pre-set
const api = async (path, options = {}) => {
  const token = localStorage.getItem("ss_token");
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && token !== "demo-token" ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    localStorage.removeItem("ss_token");
    localStorage.removeItem("ss_user");
    window.location.reload();
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
};

// ─── THEME ───────────────────────────────────────────────────────────────────
const themes = {
  dark: {
    bg: "#0d1117", surface: "#161b22", card: "#1c2128", border: "#30363d",
    text: "#e6edf3", muted: "#8b949e", primary: "#3fb950",
    primaryDim: "rgba(63,185,80,0.12)", warning: "#d29922",
    warningDim: "rgba(210,153,34,0.12)", danger: "#f85149",
    dangerDim: "rgba(248,81,73,0.12)", info: "#58a6ff",
    infoDim: "rgba(88,166,255,0.12)", sidebar: "#010409",
    sidebarBorder: "#21262d", inputBg: "#0d1117",
  },
  light: {
    bg: "#f0f4f8", surface: "#ffffff", card: "#ffffff", border: "#d0d7de",
    text: "#1f2328", muted: "#656d76", primary: "#1a7f37",
    primaryDim: "rgba(26,127,55,0.10)", warning: "#9a6700",
    warningDim: "rgba(154,103,0,0.10)", danger: "#cf222e",
    dangerDim: "rgba(207,34,46,0.10)", info: "#0969da",
    infoDim: "rgba(9,105,218,0.10)", sidebar: "#ffffff",
    sidebarBorder: "#d0d7de", inputBg: "#f6f8fa",
  },
};

// ─── FALLBACK MOCK DATA (used when backend is offline) ───────────────────────
const FALLBACK_PRODUCTS = [
  { id:1, name:"Organic Coffee Beans 1kg", sku:"COF-001", category:"Beverages",  stock:342, reorder_level:100, optimal_stock:400, eoq:280, price:12.5,  supplier:"BeanCo Ltd",    status:"optimal"  },
  { id:2, name:"Premium Olive Oil 500ml",  sku:"OIL-023", category:"Condiments", stock:45,  reorder_level:80,  optimal_stock:200, eoq:160, price:8.99,  supplier:"MedOil SA",     status:"low"      },
  { id:3, name:"Whole Wheat Pasta 500g",   sku:"PAS-112", category:"Grains",     stock:12,  reorder_level:50,  optimal_stock:150, eoq:120, price:2.49,  supplier:"GrainMasters",  status:"critical" },
  { id:4, name:"Almond Milk 1L",           sku:"MLK-045", category:"Dairy Alt",  stock:580, reorder_level:100, optimal_stock:300, eoq:200, price:3.99,  supplier:"NutriDrink Co", status:"overstock"},
  { id:5, name:"Dark Chocolate Bar 100g",  sku:"CHO-067", category:"Snacks",     stock:198, reorder_level:75,  optimal_stock:250, eoq:175, price:4.5,   supplier:"ChocoWorld",    status:"optimal"  },
  { id:6, name:"Basmati Rice 2kg",         sku:"RIC-034", category:"Grains",     stock:28,  reorder_level:60,  optimal_stock:180, eoq:140, price:5.99,  supplier:"RiceFields",    status:"low"      },
  { id:7, name:"Greek Yogurt 500g",        sku:"YOG-089", category:"Dairy",      stock:8,   reorder_level:40,  optimal_stock:120, eoq:95,  price:3.29,  supplier:"DairyFresh",    status:"critical" },
  { id:8, name:"Sparkling Water 12pk",     sku:"WAT-012", category:"Beverages",  stock:445, reorder_level:80,  optimal_stock:200, eoq:160, price:6.99,  supplier:"AquaSpring",    status:"overstock"},
];
const FALLBACK_SALES = [
  { sale_id:"S001", product_name:"Organic Coffee Beans 1kg", sku:"COF-001", quantity:24, sale_time:"2026-03-13 09:14", total_amount:300.0  },
  { sale_id:"S002", product_name:"Premium Olive Oil 500ml",  sku:"OIL-023", quantity:8,  sale_time:"2026-03-13 10:32", total_amount:71.92  },
  { sale_id:"S003", product_name:"Whole Wheat Pasta 500g",   sku:"PAS-112", quantity:30, sale_time:"2026-03-12 14:05", total_amount:74.7   },
  { sale_id:"S004", product_name:"Dark Chocolate Bar 100g",  sku:"CHO-067", quantity:15, sale_time:"2026-03-12 16:50", total_amount:67.5   },
];

// ─── STYLES ───────────────────────────────────────────────────────────────────
const injectStyles = (t) => `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@600;700;800&family=DM+Sans:wght@400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; background: ${t.bg}; color: ${t.text}; min-height: 100vh; transition: background 0.3s, color 0.3s; }
  ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: ${t.border}; border-radius: 3px; }
  input, textarea, select { font-family: 'DM Sans', sans-serif; }

  .app-layout { display: flex; height: 100vh; overflow: hidden; }
  .sidebar { width: 240px; min-width: 240px; background: ${t.sidebar}; border-right: 1px solid ${t.sidebarBorder}; display: flex; flex-direction: column; transition: width 0.3s ease; overflow: hidden; }
  .sidebar.collapsed { width: 60px; min-width: 60px; }
  .sidebar-logo { padding: 20px 16px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid ${t.sidebarBorder}; }
  .logo-icon { width: 32px; height: 32px; background: ${t.primary}; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .logo-text { font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 800; color: ${t.text}; white-space: nowrap; }
  .logo-sub  { font-size: 10px; color: ${t.muted}; white-space: nowrap; }
  .nav-items { padding: 12px 8px; flex: 1; display: flex; flex-direction: column; gap: 2px; }
  .nav-item  { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 8px; cursor: pointer; color: ${t.muted}; font-size: 13px; font-weight: 500; transition: all 0.15s; white-space: nowrap; border: none; background: none; width: 100%; text-align: left; }
  .nav-item:hover  { background: ${t.primaryDim}; color: ${t.text}; }
  .nav-item.active { background: ${t.primaryDim}; color: ${t.primary}; }
  .nav-item svg { flex-shrink: 0; }
  .sidebar-collapse-btn { padding: 12px 8px; border-top: 1px solid ${t.sidebarBorder}; }
  .collapse-btn { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 8px; border-radius: 8px; background: none; border: none; color: ${t.muted}; cursor: pointer; font-size: 12px; font-family: 'DM Sans', sans-serif; transition: all 0.15s; }
  .collapse-btn:hover { background: ${t.primaryDim}; color: ${t.text}; }

  .main-area { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .topbar { background: ${t.surface}; border-bottom: 1px solid ${t.border}; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
  .search-bar { display: flex; align-items: center; gap: 8px; background: ${t.inputBg}; border: 1px solid ${t.border}; border-radius: 8px; padding: 8px 14px; width: 300px; }
  .search-bar input { background: none; border: none; outline: none; color: ${t.text}; font-size: 13px; width: 100%; }
  .search-bar input::placeholder { color: ${t.muted}; }
  .topbar-actions { display: flex; align-items: center; gap: 10px; }
  .icon-btn { background: none; border: 1px solid ${t.border}; border-radius: 8px; padding: 7px 8px; cursor: pointer; color: ${t.muted}; display: flex; align-items: center; justify-content: center; transition: all 0.15s; position: relative; }
  .icon-btn:hover { background: ${t.primaryDim}; color: ${t.primary}; border-color: ${t.primary}; }
  .notif-dot { position: absolute; top: 5px; right: 5px; width: 7px; height: 7px; background: ${t.danger}; border-radius: 50%; border: 2px solid ${t.surface}; }
  .avatar-btn { width: 32px; height: 32px; border-radius: 8px; background: ${t.primaryDim}; border: 1px solid ${t.primary}; color: ${t.primary}; font-weight: 700; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-family: 'DM Mono', monospace; }
  .page-content { flex: 1; overflow-y: auto; padding: 24px; }
  .page-header { margin-bottom: 24px; }
  .page-title { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; color: ${t.text}; }
  .page-subtitle { font-size: 13px; color: ${t.muted}; margin-top: 4px; }

  .card { background: ${t.card}; border: 1px solid ${t.border}; border-radius: 12px; }
  .grid-4   { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .grid-3   { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .grid-2   { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .grid-5-3 { display: grid; grid-template-columns: 5fr 3fr; gap: 16px; }
  .mt-16 { margin-top: 16px; }

  .stat-card  { padding: 20px; display: flex; align-items: flex-start; gap: 14px; }
  .stat-icon  { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .stat-label { font-size: 12px; color: ${t.muted}; font-weight: 500; }
  .stat-value { font-family: 'Syne', sans-serif; font-size: 26px; font-weight: 800; color: ${t.text}; line-height: 1.1; margin-top: 2px; }
  .stat-change { font-size: 11px; margin-top: 4px; font-weight: 600; font-family: 'DM Mono', monospace; }
  .trend-up   { color: ${t.primary}; }
  .trend-down { color: ${t.danger}; }

  .card-header { padding: 16px 20px; border-bottom: 1px solid ${t.border}; display: flex; align-items: center; justify-content: space-between; }
  .card-title  { font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; color: ${t.text}; }
  .badge           { display: inline-flex; align-items: center; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; font-family: 'DM Mono', monospace; border: 1px solid; }
  .badge-optimal   { background: ${t.primaryDim}; color: ${t.primary}; border-color: rgba(63,185,80,0.3); }
  .badge-low       { background: ${t.warningDim}; color: ${t.warning}; border-color: rgba(210,153,34,0.3); }
  .badge-critical  { background: ${t.dangerDim};  color: ${t.danger};  border-color: rgba(248,81,73,0.3); }
  .badge-overstock { background: ${t.infoDim};    color: ${t.info};    border-color: rgba(88,166,255,0.3); }

  .table-container { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 10px 16px; font-size: 11px; font-weight: 600; color: ${t.muted}; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid ${t.border}; white-space: nowrap; }
  td { padding: 12px 16px; border-bottom: 1px solid ${t.border}; color: ${t.text}; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: ${t.primaryDim}; }
  .mono { font-family: 'DM Mono', monospace; font-size: 12px; color: ${t.muted}; }

  .filter-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
  .filter-tab { padding: 5px 12px; border-radius: 6px; border: 1px solid ${t.border}; background: none; color: ${t.muted}; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s; font-family: 'DM Sans', sans-serif; }
  .filter-tab.active { background: ${t.primary}; border-color: ${t.primary}; color: #fff; }
  .filter-tab:hover:not(.active) { border-color: ${t.primary}; color: ${t.primary}; }

  .alert-item { padding: 14px 20px; display: flex; align-items: center; gap: 14px; border-bottom: 1px solid ${t.border}; transition: background 0.15s; }
  .alert-item:last-child { border-bottom: none; }
  .alert-item:hover { background: ${t.primaryDim}; }
  .alert-icon-wrap { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .alert-meta    { flex: 1; min-width: 0; }
  .alert-product { font-size: 13px; font-weight: 600; color: ${t.text}; }
  .alert-msg     { font-size: 12px; color: ${t.muted}; margin-top: 2px; }
  .action-btn { padding: 6px 12px; border-radius: 6px; border: none; font-size: 12px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; display: flex; align-items: center; gap: 4px; transition: opacity 0.15s; }
  .action-btn:hover    { opacity: 0.85; }
  .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-primary { background: ${t.primary}; color: #fff; }
  .btn-outline { background: none; border: 1px solid ${t.border}; color: ${t.text}; padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.15s; }
  .btn-outline:hover { border-color: ${t.primary}; color: ${t.primary}; }

  .stock-bar-track { width: 100%; height: 4px; border-radius: 2px; background: ${t.border}; margin-top: 4px; }
  .stock-bar-fill  { height: 4px; border-radius: 2px; transition: width 0.3s; }

  .spinner { width: 20px; height: 20px; border: 2px solid ${t.border}; border-top-color: ${t.primary}; border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-row { display: flex; align-items: center; justify-content: center; padding: 40px; gap: 12px; color: ${t.muted}; font-size: 13px; }

  .toast { position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%); padding: 12px 20px; border-radius: 10px; font-size: 13px; font-weight: 500; z-index: 2000; animation: toastIn 0.3s ease; box-shadow: 0 8px 24px rgba(0,0,0,0.3); white-space: nowrap; }
  .toast-success { background: ${t.primary}; color: #fff; }
  .toast-error   { background: ${t.danger};  color: #fff; }
  @keyframes toastIn { from { opacity:0; transform: translateX(-50%) translateY(10px); } to { opacity:1; transform: translateX(-50%) translateY(0); } }

  .login-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: ${t.bg}; position: relative; overflow: hidden; }
  .login-bg-grid { position: absolute; inset: 0; background-image: linear-gradient(${t.border} 1px, transparent 1px), linear-gradient(90deg, ${t.border} 1px, transparent 1px); background-size: 40px 40px; opacity: 0.3; }
  .login-card { background: ${t.card}; border: 1px solid ${t.border}; border-radius: 16px; padding: 40px; width: 400px; position: relative; z-index: 1; }
  .login-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 32px; }
  .login-title    { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; color: ${t.text}; }
  .login-subtitle { font-size: 13px; color: ${t.muted}; margin-top: 4px; }
  .form-group { margin-bottom: 16px; }
  .form-label { display: block; font-size: 12px; font-weight: 600; color: ${t.muted}; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em; }
  .form-input { width: 100%; padding: 10px 14px; background: ${t.inputBg}; border: 1px solid ${t.border}; border-radius: 8px; color: ${t.text}; font-size: 13px; outline: none; transition: border-color 0.15s; font-family: 'DM Sans', sans-serif; }
  .form-input:focus { border-color: ${t.primary}; }
  .form-input::placeholder { color: ${t.muted}; }
  .submit-btn { width: 100%; padding: 11px; background: ${t.primary}; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'Syne', sans-serif; transition: opacity 0.15s; margin-top: 8px; }
  .submit-btn:hover    { opacity: 0.9; }
  .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .switch-auth { text-align: center; margin-top: 20px; font-size: 13px; color: ${t.muted}; }
  .switch-auth a { color: ${t.primary}; cursor: pointer; font-weight: 600; }
  .error-msg { background: ${t.dangerDim}; border: 1px solid rgba(248,81,73,0.3); color: ${t.danger}; padding: 10px 14px; border-radius: 8px; font-size: 12px; margin-bottom: 16px; }
  .role-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px; }
  .role-tab { padding: 8px; border-radius: 8px; border: 1px solid ${t.border}; background: none; color: ${t.muted}; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s; font-family: 'DM Sans', sans-serif; }
  .role-tab.active { border-color: ${t.primary}; background: ${t.primaryDim}; color: ${t.primary}; }

  .chatbot-fab { position: fixed; bottom: 24px; right: 24px; width: 52px; height: 52px; border-radius: 14px; background: ${t.primary}; border: none; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 20px rgba(63,185,80,0.4); z-index: 999; transition: transform 0.2s; }
  .chatbot-fab:hover { transform: scale(1.05); }
  .chatbot-panel { position: fixed; bottom: 88px; right: 24px; width: 360px; height: 480px; background: ${t.card}; border: 1px solid ${t.border}; border-radius: 16px; display: flex; flex-direction: column; z-index: 998; box-shadow: 0 16px 48px rgba(0,0,0,0.3); overflow: hidden; }
  .chat-header { padding: 14px 18px; border-bottom: 1px solid ${t.border}; display: flex; align-items: center; gap: 10px; }
  .chat-status { width: 8px; height: 8px; border-radius: 50%; background: ${t.primary}; }
  .chat-title  { font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; color: ${t.text}; flex: 1; }
  .chat-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
  .chat-msg { max-width: 80%; }
  .chat-msg.bot  { align-self: flex-start; }
  .chat-msg.user { align-self: flex-end; }
  .chat-bubble { padding: 9px 13px; border-radius: 12px; font-size: 13px; line-height: 1.5; }
  .chat-msg.bot  .chat-bubble { background: ${t.surface}; border: 1px solid ${t.border}; color: ${t.text}; border-radius: 4px 12px 12px 12px; }
  .chat-msg.user .chat-bubble { background: ${t.primary}; color: #fff; border-radius: 12px 4px 12px 12px; }
  .chat-input-row { padding: 12px 14px; border-top: 1px solid ${t.border}; display: flex; gap: 8px; }
  .chat-input { flex: 1; padding: 9px 12px; background: ${t.inputBg}; border: 1px solid ${t.border}; border-radius: 8px; color: ${t.text}; font-size: 13px; outline: none; font-family: 'DM Sans', sans-serif; }
  .chat-input:focus { border-color: ${t.primary}; }
  .chat-send-btn { padding: 9px 14px; background: ${t.primary}; border: none; border-radius: 8px; color: #fff; cursor: pointer; }
  .quick-replies { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 14px 8px; }
  .quick-reply { padding: 5px 10px; border: 1px solid ${t.border}; border-radius: 20px; background: none; color: ${t.muted}; font-size: 11px; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.15s; }
  .quick-reply:hover { border-color: ${t.primary}; color: ${t.primary}; }

  .eoq-panel   { padding: 20px; }
  .eoq-formula { background: ${t.inputBg}; border: 1px solid ${t.border}; border-radius: 8px; padding: 12px 16px; font-family: 'DM Mono', monospace; font-size: 13px; color: ${t.primary}; margin: 12px 0; text-align: center; }
  .eoq-inputs  { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .eoq-input-group label { display: block; font-size: 11px; color: ${t.muted}; font-weight: 600; margin-bottom: 4px; }
  .eoq-result  { background: ${t.primaryDim}; border: 1px solid rgba(63,185,80,0.3); border-radius: 10px; padding: 16px; display: flex; align-items: center; justify-content: space-between; }
  .rop-result  { background: ${t.warningDim}; border: 1px solid rgba(210,153,34,0.3); border-radius: 10px; padding: 16px; display: flex; align-items: center; justify-content: space-between; margin-top: 10px; }
  .eoq-result-label { font-size: 12px; color: ${t.muted}; }
  .eoq-result-value { font-family: 'Syne', sans-serif; font-size: 28px; font-weight: 800; color: ${t.primary}; }
  .rop-result-value { font-family: 'Syne', sans-serif; font-size: 28px; font-weight: 800; color: ${t.warning}; }

  .toggle-track { width: 40px; height: 22px; border-radius: 11px; position: relative; cursor: pointer; transition: background 0.2s; border: none; }
  .toggle-thumb { width: 16px; height: 16px; background: #fff; border-radius: 50%; position: absolute; top: 3px; left: 3px; transition: left 0.2s; }
  .toggle-thumb.on { left: 21px; }

  .settings-section { margin-bottom: 24px; }
  .settings-title { font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700; color: ${t.text}; margin-bottom: 12px; }
  .settings-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid ${t.border}; }
  .settings-row:last-child { border-bottom: none; }
  .settings-label { font-size: 13px; font-weight: 500; color: ${t.text}; }
  .settings-desc  { font-size: 12px; color: ${t.muted}; margin-top: 2px; }

  .product-controls { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
  .add-btn { padding: 9px 18px; background: ${t.primary}; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; display: flex; align-items: center; gap: 6px; }
  .search-input { padding: 9px 14px; background: ${t.inputBg}; border: 1px solid ${t.border}; border-radius: 8px; color: ${t.text}; font-size: 13px; outline: none; font-family: 'DM Sans', sans-serif; width: 220px; }
  .search-input::placeholder { color: ${t.muted}; }
  .search-input:focus { border-color: ${t.primary}; }

  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; }
  .modal-box { background: ${t.card}; border: 1px solid ${t.border}; border-radius: 16px; padding: 32px; width: 480px; max-height: 90vh; overflow-y: auto; }
  .modal-title { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 800; color: ${t.text}; margin-bottom: 20px; }
  .modal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .modal-actions { display: flex; gap: 10px; margin-top: 24px; justify-content: flex-end; }

  .rop-explanation { background: ${t.warningDim}; border: 1px solid rgba(210,153,34,0.3); border-radius: 10px; padding: 14px 18px; margin-bottom: 16px; font-size: 13px; color: ${t.warning}; }

  .page-fade { animation: fadeIn 0.25s ease; }
  @keyframes fadeIn { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: translateY(0); } }

  @media (max-width: 768px) {
    .sidebar { display: none; }
    .grid-4, .grid-3 { grid-template-columns: 1fr 1fr; }
    .grid-5-3 { grid-template-columns: 1fr; }
    .chatbot-panel { width: calc(100vw - 32px); right: 16px; }
  }
`;

// ─── ICONS ────────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 16, stroke = "currentColor", fill = "none", ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...rest}>
    {Array.isArray(d) ? d.map((p,i) => <path key={i} d={p}/>) : <path d={d}/>}
  </svg>
);
const icons = {
  dashboard:    "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
  package:      "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12",
  chart:        "M18 20V10 M12 20V4 M6 20v-6",
  alert:        "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01",
  settings:     "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  sun:          "M12 16a4 4 0 100-8 4 4 0 000 8z M12 2v2 M12 20v2 M4.93 4.93l1.41 1.41 M17.66 17.66l1.41 1.41 M2 12h2 M20 12h2 M6.34 17.66l-1.41 1.41 M19.07 4.93l-1.41 1.41",
  moon:         "M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z",
  search:       "M11 17A6 6 0 1011 5a6 6 0 000 12z M21 21l-4.35-4.35",
  bell:         "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0",
  chat:         "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  send:         "M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z",
  plus:         "M12 5v14 M5 12h14",
  x:            "M18 6L6 18 M6 6l12 12",
  chevronLeft:  "M15 18l-6-6 6-6",
  chevronRight: "M9 18l6-6-6-6",
  trendingDown: "M23 18l-9.5-9.5-5 5L1 6 M17 18h6v-6",
  trendingUp:   "M23 6l-9.5 9.5-5-5L1 18 M17 6h6v6",
  store:        "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z",
  sales:        "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17 M9 21a1 1 0 100-2 1 1 0 000 2z M20 21a1 1 0 100-2 1 1 0 000 2z",
  logout:       "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4 M16 17l5-5-5-5 M21 12H9",
};

// ─── TOAST ────────────────────────────────────────────────────────────────────
function Toast({ message, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, []);
  return <div className={`toast toast-${type}`}>{message}</div>;
}

// ─── CHATBOT ──────────────────────────────────────────────────────────────────
const botReplies = {
  eoq:         "EOQ = √(2DS/H). D = annual demand, S = ordering cost, H = holding cost. Gives you the optimal quantity to order each time to minimize total costs.",
  rop:         "ROP = (Lead Time × Daily Sales Velocity) + Safety Stock. When stock drops to this level, place a new order to avoid stockouts.",
  "low stock": "Check the Alerts page for critical and low-stock items with auto-generated purchase order suggestions.",
  overstock:   "Overstocked items exceed optimal stock by 20%+. Consider running promotions or returning excess to supplier.",
  forecast:    "The Analytics page uses linear regression on past sales data to predict future demand month by month.",
  sales:       "Head to the Sales page to see your full transaction history, revenue KPIs, and stock movement.",
  sku:         "SKU = Stock Keeping Unit. A unique code for each product. Example: COF-001 for Organic Coffee Beans.",
  help:        "I can help with: EOQ, ROP, low stock alerts, demand forecasting, sales history, and SKU lookups!",
  default:     "Good question! Check the Analytics page for ML-driven insights, or type 'help' to see what I can assist with.",
};
const getBotReply = (msg) => {
  const m = msg.toLowerCase();
  for (const [k,v] of Object.entries(botReplies)) { if (m.includes(k)) return v; }
  return botReplies.default;
};

function Chatbot({ t }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([{ role:"bot", text:"Hi! I'm your SmartStock AI 🤖 Ask about EOQ, ROP, forecasting, or stock alerts!" }]);
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs]);
  const send = (text) => {
    const msg = text || input.trim(); if (!msg) return;
    setInput("");
    setMsgs(prev => [...prev, { role:"user", text:msg }, { role:"bot", text:getBotReply(msg) }]);
  };
  return (
    <>
      {open && (
        <div className="chatbot-panel">
          <div className="chat-header">
            <div className="chat-status"/>
            <span className="chat-title">SmartStock AI</span>
            <button className="icon-btn" style={{ border:"none", padding:4 }} onClick={() => setOpen(false)}><Icon d={icons.x} size={14}/></button>
          </div>
          <div className="chat-messages">
            {msgs.map((m,i) => <div key={i} className={`chat-msg ${m.role}`}><div className="chat-bubble">{m.text}</div></div>)}
            <div ref={bottomRef}/>
          </div>
          <div className="quick-replies">
            {["EOQ?","Low stock?","Forecast?","Help"].map(q => <button key={q} className="quick-reply" onClick={() => send(q)}>{q}</button>)}
          </div>
          <div className="chat-input-row">
            <input className="chat-input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==="Enter" && send()} placeholder="Ask about inventory..."/>
            <button className="chat-send-btn" onClick={() => send()}><Icon d={icons.send} size={14}/></button>
          </div>
        </div>
      )}
      <button className="chatbot-fab" onClick={() => setOpen(o => !o)}><Icon d={open ? icons.x : icons.chat} size={20}/></button>
    </>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const buildCategoryData = (products) => {
  const map = {};
  products.forEach(p => { map[p.category] = (map[p.category] || 0) + p.stock; });
  return Object.entries(map).map(([name, stock]) => ({ name, stock }));
};
const buildStatusDist = (products) => {
  const c = { optimal:0, low:0, critical:0, overstock:0 };
  products.forEach(p => { if (c[p.status] !== undefined) c[p.status]++; });
  const total = products.length || 1;
  return [
    { name:"Optimal",   value: Math.round(c.optimal/total*100),   color:"#3fb950" },
    { name:"Low Stock", value: Math.round(c.low/total*100),       color:"#d29922" },
    { name:"Critical",  value: Math.round(c.critical/total*100),  color:"#f85149" },
    { name:"Overstock", value: Math.round(c.overstock/total*100), color:"#58a6ff" },
  ];
};
const StockBar = ({ stock, optimal, t }) => {
  const pct = Math.min(Math.round((stock / (optimal||1)) * 100), 100);
  const color = pct > 80 ? t.primary : pct > 40 ? t.warning : t.danger;
  return <><span style={{ fontWeight:600 }}>{stock}</span><div className="stock-bar-track"><div className="stock-bar-fill" style={{ width:`${pct}%`, background:color }}/></div></>;
};

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ t, toast }) {
  const [products, setProducts] = useState(FALLBACK_PRODUCTS);
  const [stats,    setStats]    = useState(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([
      api("/inventory/products").catch(() => null),
      api("/inventory/stats").catch(() => null),
    ]).then(([prods, s]) => {
      if (prods) setProducts(prods);
      if (s)     setStats(s);
      setLoading(false);
    });
  }, []);

  const categoryData = buildCategoryData(products);
  const statusDist   = buildStatusDist(products);
  const alertItems   = products.filter(p => p.status==="critical" || p.status==="low");

  const kpis = [
    { label:"Total SKUs",       value: loading ? "…" : stats ? stats.total_skus.toLocaleString() : products.length.toString(), icon:icons.package,     color:t.info,    bg:t.infoDim    },
    { label:"Stock Value",      value: loading ? "…" : stats ? `$${(stats.stock_value/1000).toFixed(1)}K` : "—",               icon:icons.chart,       color:t.primary, bg:t.primaryDim },
    { label:"Low Stock Alerts", value: loading ? "…" : (stats?.low_alerts ?? alertItems.length).toString(),                    icon:icons.alert,       color:t.warning, bg:t.warningDim },
    { label:"Total Revenue",    value: loading ? "…" : stats ? `$${(stats.total_revenue/1000).toFixed(1)}K` : "—",             icon:icons.trendingUp,  color:t.primary, bg:t.primaryDim },
  ];

  return (
    <div className="page-fade">
      <div className="page-header"><div className="page-title">Dashboard</div><div className="page-subtitle">Real-time inventory insights and optimization recommendations</div></div>
      <div className="grid-4">
        {kpis.map(s => (
          <div key={s.label} className="card"><div className="stat-card">
            <div className="stat-icon" style={{ background:s.bg }}><Icon d={s.icon} size={18} stroke={s.color}/></div>
            <div><div className="stat-label">{s.label}</div><div className="stat-value">{s.value}</div></div>
          </div></div>
        ))}
      </div>
      <div className="grid-3 mt-16">
        <div className="card">
          <div className="card-header"><span className="card-title">Stock by Category</span></div>
          <div style={{ padding:16 }}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={categoryData} layout="vertical" margin={{ left:10, top:10, right:10, bottom:10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.border}/>
                <XAxis type="number" tick={{ fontSize:11, fill:t.muted }}/>
                <YAxis dataKey="name" type="category" tick={{ fontSize:11, fill:t.muted }} width={95}/>
                <Tooltip contentStyle={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:8, fontSize:12, color:t.text }}/>
                <Bar dataKey="stock" fill={t.primary} radius={[0,4,4,0]} barSize={18}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Status Distribution</span></div>
          <div style={{ padding:16 }}>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart><Pie data={statusDist} cx="50%" cy="50%" innerRadius={48} outerRadius={72} dataKey="value" paddingAngle={3}>
                {statusDist.map((e,i) => <Cell key={i} fill={e.color}/>)}
              </Pie>
              <Tooltip contentStyle={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:8, fontSize:12, color:t.text }}/></PieChart>
            </ResponsiveContainer>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"center", marginTop:4 }}>
              {statusDist.map(s => <div key={s.name} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:t.muted }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:s.color }}/>{s.name} ({s.value}%)</div>)}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Stock Level Trend</span></div>
          <div style={{ padding:16 }}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={[
                {month:"Sep",stockLevel:82,turnover:3.8},{month:"Oct",stockLevel:78,turnover:4.0},
                {month:"Nov",stockLevel:85,turnover:4.1},{month:"Dec",stockLevel:91,turnover:4.5},
                {month:"Jan",stockLevel:88,turnover:4.2},{month:"Feb",stockLevel:86,turnover:4.2},{month:"Mar",stockLevel:84,turnover:4.4},
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.border}/>
                <XAxis dataKey="month" tick={{ fontSize:11, fill:t.muted }}/>
                <YAxis tick={{ fontSize:11, fill:t.muted }}/>
                <Tooltip contentStyle={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:8, fontSize:12, color:t.text }}/>
                <Line type="monotone" dataKey="stockLevel" stroke={t.primary} strokeWidth={2} dot={{ r:3 }} name="Stock %"/>
                <Line type="monotone" dataKey="turnover"   stroke={t.info}    strokeWidth={2} dot={{ r:3 }} name="Turnover"/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="grid-5-3 mt-16">
        <div className="card">
          <div className="card-header"><span className="card-title">Inventory Overview</span></div>
          {loading ? <div className="loading-row"><div className="spinner"/> Loading…</div> : (
            <div className="table-container"><table>
              <thead><tr><th>Product</th><th>SKU</th><th>Stock</th><th>ROP</th><th>Status</th></tr></thead>
              <tbody>{products.slice(0,6).map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight:500 }}>{p.name}</td>
                  <td className="mono">{p.sku}</td>
                  <td><StockBar stock={p.stock} optimal={p.optimal_stock} t={t}/></td>
                  <td className="mono">{p.reorder_level}</td>
                  <td><span className={`badge badge-${p.status}`}>{p.status}</span></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">⚡ Smart Alerts</span><span className="badge badge-critical">{alertItems.length} urgent</span></div>
          {alertItems.length===0
            ? <div className="loading-row" style={{ color:t.primary }}>✓ All stock levels healthy</div>
            : alertItems.map(p => (
              <div key={p.id} className="alert-item">
                <div className="alert-icon-wrap" style={{ background: p.status==="critical" ? t.dangerDim : t.warningDim }}>
                  <Icon d={icons.trendingDown} size={14} stroke={p.status==="critical" ? t.danger : t.warning}/>
                </div>
                <div className="alert-meta"><div className="alert-product">{p.name}</div><div className="alert-msg">{p.stock} units — ROP: {p.reorder_level}</div></div>
                <button className="action-btn btn-primary" style={{ fontSize:11 }}>Order {p.eoq}</button>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}

// ─── PRODUCTS PAGE ────────────────────────────────────────────────────────────
function ProductsPage({ t, toast }) {
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState("all");
  const [showModal,setShowModal]= useState(false);
  const [saving,   setSaving]   = useState(false);
  const emptyForm = { name:"", sku:"", category:"", stock:"", reorder_level:"", optimal_stock:"", price:"", supplier:"" };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(() => {
    setLoading(true);
    api("/inventory/products")
      .then(data => { setProducts(data); setLoading(false); })
      .catch(() => { setProducts(FALLBACK_PRODUCTS); setLoading(false); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = products.filter(p =>
    (filter==="all" || p.status===filter) &&
    (p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()))
  );

  const addProduct = async () => {
    if (!form.name || !form.sku) { toast("Product name and SKU are required","error"); return; }
    setSaving(true);
    try {
      await api("/inventory/products", { method:"POST", body: JSON.stringify({ ...form, stock:+form.stock, reorder_level:+form.reorder_level, optimal_stock:+form.optimal_stock, price:+form.price }) });
      toast("Product added!","success"); setShowModal(false); setForm(emptyForm); load();
    } catch(e) { toast(e.message,"error"); }
    finally { setSaving(false); }
  };

  const deleteProduct = async (id) => {
    if (!confirm("Delete this product?")) return;
    try { await api(`/inventory/products/${id}`, { method:"DELETE" }); toast("Product deleted","success"); load(); }
    catch(e) { toast(e.message,"error"); }
  };

  return (
    <div className="page-fade">
      <div className="page-header"><div className="page-title">Products</div><div className="page-subtitle">Manage your catalog — add, update, and track by SKU</div></div>
      <div className="product-controls">
        <input className="search-input" placeholder="Search products or SKUs…" value={search} onChange={e => setSearch(e.target.value)}/>
        <div className="filter-tabs">
          {["all","critical","low","optimal","overstock"].map(f => <button key={f} className={`filter-tab ${filter===f?"active":""}`} onClick={() => setFilter(f)}>{f}</button>)}
        </div>
        <button className="add-btn" onClick={() => setShowModal(true)}><Icon d={icons.plus} size={14} stroke="#fff"/> Add Product</button>
      </div>
      <div className="card">
        {loading ? <div className="loading-row"><div className="spinner"/> Loading products…</div> : (
          <div className="table-container"><table>
            <thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Stock</th><th>ROP</th><th>EOQ</th><th>Price</th><th>Supplier</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight:600 }}>{p.name}</td>
                  <td className="mono">{p.sku}</td>
                  <td style={{ color:t.muted, fontSize:12 }}>{p.category}</td>
                  <td><StockBar stock={p.stock} optimal={p.optimal_stock} t={t}/></td>
                  <td className="mono">{p.reorder_level}</td>
                  <td className="mono" style={{ color:t.primary }}>{p.eoq||"—"}</td>
                  <td className="mono">${p.price}</td>
                  <td style={{ color:t.muted, fontSize:12 }}>{p.supplier}</td>
                  <td><span className={`badge badge-${p.status}`}>{p.status}</span></td>
                  <td><button onClick={() => deleteProduct(p.id)} style={{ background:"none", border:"none", color:t.danger, cursor:"pointer", fontSize:12 }}>✕</button></td>
                </tr>
              ))}
              {filtered.length===0 && <tr><td colSpan={10} style={{ textAlign:"center", color:t.muted, padding:32 }}>No products found</td></tr>}
            </tbody>
          </table></div>
        )}
      </div>
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowModal(false)}>
          <div className="modal-box">
            <div className="modal-title">Add New Product</div>
            <div className="modal-grid">
              {[["name","Product Name"],["sku","SKU Code"],["category","Category"],["supplier","Supplier"],["stock","Stock Qty"],["reorder_level","Reorder Level (ROP)"],["optimal_stock","Optimal Stock"],["price","Unit Cost ($)"]].map(([k,label]) => (
                <div key={k} className="form-group" style={{ margin:0 }}>
                  <label className="form-label">{label}</label>
                  <input className="form-input" value={form[k]} onChange={e => setForm(f => ({ ...f, [k]:e.target.value }))} placeholder={label}/>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="action-btn btn-primary" style={{ padding:"9px 20px", fontSize:13 }} onClick={addProduct} disabled={saving}>{saving?"Saving…":"Add Product"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SALES PAGE ───────────────────────────────────────────────────────────────
function SalesPage({ t }) {
  const [sales,   setSales]   = useState([]);
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api("/inventory/sales").catch(() => null), api("/inventory/stats").catch(() => null)])
      .then(([s, st]) => { setSales(s || FALLBACK_SALES); setStats(st); setLoading(false); });
  }, []);

  const totalRevenue = sales.reduce((a,s) => a + s.total_amount, 0);
  const avgOrder     = sales.length ? totalRevenue / sales.length : 0;

  const kpis = [
    { label:"Total Revenue",     value: stats ? `$${stats.total_revenue?.toFixed(2)}` : `$${totalRevenue.toFixed(2)}` },
    { label:"Transactions",      value: sales.length.toString() },
    { label:"Avg Order Value",   value: `$${avgOrder.toFixed(2)}` },
    { label:"Top SKU",           value: sales[0]?.sku || "—" },
  ];

  return (
    <div className="page-fade">
      <div className="page-header"><div className="page-title">Sales Tracking</div><div className="page-subtitle">Transaction history · Stock movement · Revenue tracking</div></div>
      <div className="grid-4" style={{ marginBottom:16 }}>
        {kpis.map(s => <div key={s.label} className="card"><div className="stat-card" style={{ padding:"14px 16px" }}><div><div className="stat-label">{s.label}</div><div className="stat-value" style={{ fontSize:20 }}>{s.value}</div></div></div></div>)}
      </div>
      <div className="card">
        <div className="card-header"><span className="card-title">Sales History</span><span style={{ fontSize:12, color:t.muted }}>{sales.length} records</span></div>
        {loading ? <div className="loading-row"><div className="spinner"/> Loading sales…</div> : (
          <div className="table-container"><table>
            <thead><tr><th>Sale ID</th><th>Product</th><th>SKU</th><th>Qty</th><th>Total</th><th>Date & Time</th></tr></thead>
            <tbody>
              {sales.map((s,i) => (
                <tr key={s.sale_id||i}>
                  <td className="mono">{s.sale_id}</td>
                  <td style={{ fontWeight:500 }}>{s.product_name}</td>
                  <td className="mono">{s.sku}</td>
                  <td style={{ fontWeight:600 }}>{s.quantity}</td>
                  <td style={{ color:t.primary, fontWeight:600, fontFamily:"'DM Mono', monospace" }}>${Number(s.total_amount).toFixed(2)}</td>
                  <td style={{ color:t.muted, fontSize:12 }}>{s.sale_time}</td>
                </tr>
              ))}
              {sales.length===0 && <tr><td colSpan={6} style={{ textAlign:"center", color:t.muted, padding:32 }}>No sales recorded yet</td></tr>}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}

// ─── ANALYTICS PAGE ───────────────────────────────────────────────────────────
function AnalyticsPage({ t }) {
  const [forecast,  setForecast]  = useState([]);
  const [peakHours, setPeakHours] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [eoqD, setEoqD] = useState(500);
  const [eoqS, setEoqS] = useState(50);
  const [eoqH, setEoqH] = useState(2);
  const [leadTime,    setLeadTime]    = useState(7);
  const [dailySales,  setDailySales]  = useState(15);
  const [safetyStock, setSafetyStock] = useState(30);

  const eoq = Math.round(Math.sqrt((2 * eoqD * eoqS) / eoqH));
  const rop  = Math.round(leadTime * dailySales + +safetyStock);

  useEffect(() => {
    Promise.all([api("/analytics/forecast").catch(() => null), api("/analytics/peak-hours").catch(() => null)])
      .then(([f, p]) => { if (f?.data?.length) setForecast(f.data); if (p?.data?.length) setPeakHours(p.data); setLoading(false); });
  }, []);

  const forecastData = forecast.length ? forecast : [
    {month:"Sep",actual:420,predicted:null},{month:"Oct",actual:460,predicted:null},{month:"Nov",actual:510,predicted:null},
    {month:"Dec",actual:580,predicted:null},{month:"Jan",actual:490,predicted:null},{month:"Feb",actual:505,predicted:null},
    {month:"Mar",actual:530,predicted:null},{month:"Apr",actual:null,predicted:548},{month:"May",actual:null,predicted:562},
  ];
  const peakData = peakHours.length ? peakHours : [
    {hour:"8am",sales:28},{hour:"9am",sales:45},{hour:"10am",sales:62},{hour:"11am",sales:58},
    {hour:"12pm",sales:89},{hour:"1pm",sales:76},{hour:"2pm",sales:55},{hour:"3pm",sales:70},
    {hour:"4pm",sales:82},{hour:"5pm",sales:94},{hour:"6pm",sales:71},{hour:"7pm",sales:38},
  ];

  return (
    <div className="page-fade">
      <div className="page-header"><div className="page-title">Analytics & Forecasting</div><div className="page-subtitle">Demand forecasting · EOQ & ROP calculator · Peak sales analysis</div></div>
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">📈 Demand Forecast (Linear Regression)</span>
            <span className="badge" style={{ background:t.infoDim, color:t.info, borderColor:`${t.info}44` }}>ML Model</span>
          </div>
          <div style={{ padding:16 }}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={forecastData}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.border}/>
                <XAxis dataKey="month" tick={{ fontSize:11, fill:t.muted }}/>
                <YAxis tick={{ fontSize:11, fill:t.muted }}/>
                <Tooltip contentStyle={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:8, fontSize:12, color:t.text }}/>
                <Legend wrapperStyle={{ fontSize:11 }}/>
                <Line type="monotone" dataKey="actual"    stroke={t.primary} strokeWidth={2} dot={{ r:3 }} name="Actual Demand"  connectNulls={false}/>
                <Line type="monotone" dataKey="predicted" stroke={t.info}    strokeWidth={2} strokeDasharray="5 5" dot={{ r:3 }} name="Predicted" connectNulls={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">⚖️ EOQ & ROP Calculator</span></div>
          <div className="eoq-panel">
            <div style={{ fontSize:12, color:t.muted, marginBottom:8 }}>
              <strong style={{ color:t.text }}>EOQ</strong> — How much to order &nbsp;|&nbsp; <strong style={{ color:t.text }}>ROP</strong> — When to order
            </div>
            <div className="eoq-formula">EOQ = √(2DS / H)</div>
            <div className="eoq-inputs">
              {[["Annual Demand (D)",eoqD,setEoqD],["Order Cost (S $)",eoqS,setEoqS],["Holding Cost (H $)",eoqH,setEoqH]].map(([label,val,set]) => (
                <div key={label} className="eoq-input-group">
                  <label>{label}</label>
                  <input className="form-input" type="number" value={val} onChange={e => set(+e.target.value)} style={{ padding:"7px 10px" }}/>
                </div>
              ))}
            </div>
            <div className="eoq-result">
              <div><div className="eoq-result-label">Optimal Order Qty (EOQ)</div><div style={{ fontSize:11, color:t.muted }}>units per order</div></div>
              <div className="eoq-result-value">{eoq}</div>
            </div>
            <div style={{ fontSize:12, color:t.muted, margin:"12px 0 6px" }}>ROP = (Lead Time × Daily Sales) + Safety Stock</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:10 }}>
              {[["Lead Time (days)",leadTime,setLeadTime],["Daily Sales",dailySales,setDailySales],["Safety Stock",safetyStock,setSafetyStock]].map(([label,val,set]) => (
                <div key={label} className="eoq-input-group">
                  <label>{label}</label>
                  <input className="form-input" type="number" value={val} onChange={e => set(+e.target.value)} style={{ padding:"7px 10px" }}/>
                </div>
              ))}
            </div>
            <div className="rop-result">
              <div><div className="eoq-result-label">Reorder Point (ROP)</div><div style={{ fontSize:11, color:t.muted }}>order when stock hits this</div></div>
              <div className="rop-result-value">{rop}</div>
            </div>
          </div>
        </div>
      </div>
      <div className="card mt-16">
        <div className="card-header"><span className="card-title">⏰ Peak Sales Analysis — Customer Purchase Patterns</span></div>
        <div style={{ padding:16 }}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={peakData}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.border}/>
              <XAxis dataKey="hour" tick={{ fontSize:11, fill:t.muted }}/>
              <YAxis tick={{ fontSize:11, fill:t.muted }}/>
              <Tooltip contentStyle={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:8, fontSize:12, color:t.text }}/>
              <Bar dataKey="sales" fill={t.primary} radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── ALERTS PAGE ──────────────────────────────────────────────────────────────
function AlertsPage({ t, toast }) {
  const [alerts,  setAlerts]  = useState({ critical:[], low:[], overstock:[] });
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api("/inventory/products").catch(() => null).then(products => {
      const prods = products || FALLBACK_PRODUCTS;
      setAlerts({
        critical:  prods.filter(p => p.status==="critical"),
        low:       prods.filter(p => p.status==="low"),
        overstock: prods.filter(p => p.status==="overstock"),
      });
      setLoading(false);
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  const placeOrder = async (productId) => {
    setPlacing(productId);
    try {
      const res = await api(`/orders/place/${productId}`, { method:"POST" });
      toast(`Order placed: ${res.quantity} units · $${res.estimated_cost}`, "success");
    } catch(e) { toast(e.message, "error"); }
    finally { setPlacing(null); }
  };

  const allUrgent = [...alerts.critical, ...alerts.low];

  return (
    <div className="page-fade">
      <div className="page-header"><div className="page-title">Smart Alerts</div><div className="page-subtitle">ROP-triggered notifications · Purchase order suggestions</div></div>
      <div className="rop-explanation">
        🔔 <strong>How alerts work:</strong> When stock falls below the <strong>Reorder Point (ROP)</strong>, an alert triggers automatically. ROP = Lead Time × Daily Sales Velocity + Safety Stock.
      </div>
      {loading ? <div className="loading-row"><div className="spinner"/> Scanning stock levels…</div> : (
        <>
          <div className="grid-3">
            {[
              { label:"🔴 Critical",  items:alerts.critical,  cls:"badge-critical",  ic:t.danger,  bg:t.dangerDim  },
              { label:"🟡 Low Stock", items:alerts.low,       cls:"badge-low",       ic:t.warning, bg:t.warningDim },
              { label:"🔵 Overstock", items:alerts.overstock, cls:"badge-overstock", ic:t.info,    bg:t.infoDim    },
            ].map(({ label, items, cls, ic, bg }) => (
              <div key={label} className="card">
                <div className="card-header"><span className="card-title">{label}</span><span className={`badge ${cls}`}>{items.length} items</span></div>
                {items.length===0
                  ? <div style={{ padding:"20px 16px", fontSize:12, color:t.muted }}>None currently</div>
                  : items.map(p => (
                    <div key={p.id} className="alert-item">
                      <div className="alert-icon-wrap" style={{ background:bg }}><Icon d={icons.alert} size={14} stroke={ic}/></div>
                      <div className="alert-meta"><div className="alert-product">{p.name}</div><div className="alert-msg">{p.stock} units · ROP: {p.reorder_level}</div></div>
                    </div>
                  ))
                }
              </div>
            ))}
          </div>
          <div className="card mt-16">
            <div className="card-header"><span className="card-title">📋 Suggested Purchase Orders</span></div>
            <div className="table-container"><table>
              <thead><tr><th>Product</th><th>SKU</th><th>Stock</th><th>ROP</th><th>EOQ (Order Qty)</th><th>Est. Cost</th><th>Supplier</th><th>Action</th></tr></thead>
              <tbody>
                {allUrgent.length===0
                  ? <tr><td colSpan={8} style={{ textAlign:"center", color:t.muted, padding:32 }}>No urgent orders needed</td></tr>
                  : allUrgent.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight:600 }}>{p.name}</td>
                      <td className="mono">{p.sku}</td>
                      <td style={{ color: p.status==="critical" ? t.danger : t.warning, fontWeight:600 }}>{p.stock}</td>
                      <td className="mono">{p.reorder_level}</td>
                      <td style={{ color:t.primary, fontWeight:700, fontFamily:"'DM Mono', monospace" }}>{p.eoq||"—"}</td>
                      <td className="mono">{p.eoq ? `$${(p.eoq*p.price).toFixed(2)}` : "—"}</td>
                      <td style={{ color:t.muted, fontSize:12 }}>{p.supplier}</td>
                      <td><button className="action-btn btn-primary" onClick={() => placeOrder(p.id)} disabled={placing===p.id}>{placing===p.id?"Placing…":"Place Order"}</button></td>
                    </tr>
                  ))
                }
              </tbody>
            </table></div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── SETTINGS PAGE ────────────────────────────────────────────────────────────
function SettingsPage({ t, isDark, toggleTheme, user, onLogout }) {
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts,   setSmsAlerts]   = useState(false);
  const [autoReorder, setAutoReorder] = useState(true);
  const Toggle = ({ val, set }) => (
    <button className="toggle-track" style={{ background: val ? t.primary : t.border }} onClick={() => set(!val)}>
      <div className={`toggle-thumb ${val?"on":""}`}/>
    </button>
  );
  return (
    <div className="page-fade">
      <div className="page-header"><div className="page-title">Settings</div><div className="page-subtitle">Appearance, alerts, and account preferences</div></div>
      <div className="grid-2">
        <div>
          <div className="settings-section">
            <div className="settings-title">Appearance</div>
            <div className="card"><div className="settings-row">
              <div><div className="settings-label">Dark Mode</div><div className="settings-desc">Toggle dark / light theme</div></div>
              <Toggle val={isDark} set={toggleTheme}/>
            </div></div>
          </div>
          <div className="settings-section">
            <div className="settings-title">Alert Preferences</div>
            <div className="card">
              {[["Email Notifications","Low-stock alerts via email",emailAlerts,setEmailAlerts],["SMS Alerts","Urgent alerts via SMS",smsAlerts,setSmsAlerts],["Auto Reorder","AI reorder recommendations",autoReorder,setAutoReorder]].map(([label,desc,val,set]) => (
                <div key={label} className="settings-row">
                  <div><div className="settings-label">{label}</div><div className="settings-desc">{desc}</div></div>
                  <Toggle val={val} set={set}/>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div>
          <div className="settings-section">
            <div className="settings-title">Account</div>
            <div className="card">
              <div className="settings-row">
                <div><div className="settings-label">{user?.user_name || "User"}</div><div className="settings-desc">Role: {user?.user_role || "staff"}</div></div>
                <span className={`badge badge-${user?.user_role==="admin"?"optimal":"low"}`}>{user?.user_role||"staff"}</span>
              </div>
              <div className="settings-row" style={{ cursor:"pointer" }} onClick={onLogout}>
                <div className="settings-label" style={{ color:t.danger }}>Sign Out</div>
                <Icon d={icons.logout} size={16} stroke={t.danger}/>
              </div>
            </div>
          </div>
          <div className="settings-section">
            <div className="settings-title">System</div>
            <div className="card" style={{ padding:20 }}>
              <div className="form-group">
                <label className="form-label">API Endpoint</label>
                <input className="form-input" value={API_BASE} readOnly style={{ opacity:0.6, fontFamily:"'DM Mono',monospace", fontSize:12 }}/>
              </div>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">Default Lead Time (days)</label>
                <input className="form-input" type="number" defaultValue={7}/>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── LOGIN PAGE ───────────────────────────────────────────────────────────────
function LoginPage({ t, onLogin, onSwitch }) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [role,     setRole]     = useState("admin");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { setError("Please fill in all fields."); return; }
    setLoading(true); setError("");
    try {
      // FastAPI OAuth2 needs form data (not JSON)
      const body = new URLSearchParams();
      body.append("username", email);
      body.append("password", password);
      const res  = await fetch(`${API_BASE}/auth/login`, { method:"POST", headers:{ "Content-Type":"application/x-www-form-urlencoded" }, body });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail||"Login failed"); }
      const data = await res.json();
      localStorage.setItem("ss_token", data.access_token);
      localStorage.setItem("ss_user",  JSON.stringify(data));
      onLogin(data);
    } catch(e) {
      // Backend offline → allow demo login so frontend still works
      if (e.message.includes("fetch")||e.message.includes("Failed")) {
        localStorage.setItem("ss_token","demo-token");
        const demo = { user_name: email.split("@")[0]||"User", user_role: role };
        localStorage.setItem("ss_user", JSON.stringify(demo));
        onLogin(demo);
      } else { setError(e.message); }
    } finally { setLoading(false); }
  };

  return (
    <div className="login-page">
      <div className="login-bg-grid"/>
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-icon"><Icon d={icons.store} size={16} stroke="#fff"/></div>
          <div><div className="login-title">SmartStock</div><div className="login-subtitle">Inventory Optimization Platform</div></div>
        </div>
        <div style={{ marginBottom:16 }}>
          <div className="form-label" style={{ marginBottom:8 }}>Login as</div>
          <div className="role-tabs">
            {["admin","staff"].map(r => <button key={r} className={`role-tab ${role===r?"active":""}`} onClick={() => setRole(r)}>{r==="admin"?"🛡️ Admin":"👤 Staff"}</button>)}
          </div>
        </div>
        {error && <div className="error-msg">{error}</div>}
        <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" placeholder="you@example.com" value={email} onChange={e => { setEmail(e.target.value); setError(""); }}/></div>
        <div className="form-group"><label className="form-label">Password</label><input className="form-input" type="password" placeholder="••••••••" value={password} onChange={e => { setPassword(e.target.value); setError(""); }} onKeyDown={e => e.key==="Enter" && handleLogin()}/></div>
        <button className="submit-btn" onClick={handleLogin} disabled={loading}>{loading?"Signing in…":"Sign In to SmartStock →"}</button>
        <div className="switch-auth">Don't have an account? <a onClick={onSwitch}>Sign up</a></div>
      </div>
    </div>
  );
}

// ─── SIGNUP PAGE ──────────────────────────────────────────────────────────────
function SignupPage({ t, onLogin, onSwitch }) {
  const [form,    setForm]    = useState({ name:"", email:"", password:"", confirm:"", company:"", role:"staff" });
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!form.name||!form.email||!form.password) { setError("Please fill in all required fields."); return; }
    if (form.password!==form.confirm)            { setError("Passwords do not match."); return; }
    if (form.password.length<6)                  { setError("Password must be at least 6 characters."); return; }
    setLoading(true); setError("");
    try {
      const data = await api("/auth/signup", { method:"POST", body: JSON.stringify({ name:form.name, email:form.email, password:form.password, company:form.company, role:form.role }) });
      localStorage.setItem("ss_token", data.access_token);
      localStorage.setItem("ss_user",  JSON.stringify(data));
      onLogin(data);
    } catch(e) {
      if (e.message.includes("fetch")||e.message.includes("Failed")) {
        const demo = { user_name:form.name, user_role:form.role };
        localStorage.setItem("ss_token","demo-token");
        localStorage.setItem("ss_user", JSON.stringify(demo));
        onLogin(demo);
      } else { setError(e.message); }
    } finally { setLoading(false); }
  };

  return (
    <div className="login-page">
      <div className="login-bg-grid"/>
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-icon"><Icon d={icons.store} size={16} stroke="#fff"/></div>
          <div><div className="login-title">Create Account</div><div className="login-subtitle">Join SmartStock · Inventory Optimizer</div></div>
        </div>
        {error && <div className="error-msg">{error}</div>}
        {[["name","Full Name","text","Your name"],["company","Company / Store","text","Store name"],["email","Email","email","you@example.com"],["password","Password","password","Min 6 characters"],["confirm","Confirm Password","password","Re-enter password"]].map(([k,label,type,ph]) => (
          <div key={k} className="form-group"><label className="form-label">{label}</label><input className="form-input" type={type} placeholder={ph} value={form[k]} onChange={e => { setForm(f => ({ ...f, [k]:e.target.value })); setError(""); }}/></div>
        ))}
        <button className="submit-btn" onClick={handleSignup} disabled={loading}>{loading?"Creating…":"Create Account →"}</button>
        <div className="switch-auth">Already have an account? <a onClick={onSwitch}>Sign in</a></div>
      </div>
    </div>
  );
}

// ─── NAV ──────────────────────────────────────────────────────────────────────
const navItems = [
  { id:"dashboard", label:"Dashboard", icon:icons.dashboard },
  { id:"products",  label:"Products",  icon:icons.package   },
  { id:"sales",     label:"Sales",     icon:icons.sales     },
  { id:"analytics", label:"Analytics", icon:icons.chart     },
  { id:"alerts",    label:"Alerts",    icon:icons.alert     },
  { id:"settings",  label:"Settings",  icon:icons.settings  },
];

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [isDark,     setIsDark]     = useState(true);
  const [authState,  setAuthState]  = useState(() => localStorage.getItem("ss_token") ? "app" : "login");
  const [user,       setUser]       = useState(() => { try { return JSON.parse(localStorage.getItem("ss_user")); } catch { return null; } });
  const [page,       setPage]       = useState("dashboard");
  const [collapsed,  setCollapsed]  = useState(false);
  const [toastState, setToastState] = useState(null);
  const t = isDark ? themes.dark : themes.light;

  const showToast = (message, type="success") => setToastState({ message, type });

  useEffect(() => {
    let el = document.getElementById("ss-styles");
    if (!el) { el = document.createElement("style"); el.id = "ss-styles"; document.head.appendChild(el); }
    el.textContent = injectStyles(t);
  }, [isDark]);

  const handleLogin  = (userData) => { setUser(userData); setAuthState("app"); };
  const handleLogout = () => { localStorage.removeItem("ss_token"); localStorage.removeItem("ss_user"); setUser(null); setAuthState("login"); };
  const initials     = user?.user_name ? user.user_name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2) : "?";

  const renderPage = () => {
    const props = { t, toast:showToast };
    switch(page) {
      case "dashboard": return <Dashboard    {...props}/>;
      case "products":  return <ProductsPage {...props}/>;
      case "sales":     return <SalesPage    {...props}/>;
      case "analytics": return <AnalyticsPage {...props}/>;
      case "alerts":    return <AlertsPage   {...props}/>;
      case "settings":  return <SettingsPage {...props} isDark={isDark} toggleTheme={() => setIsDark(d=>!d)} user={user} onLogout={handleLogout}/>;
      default:          return <Dashboard    {...props}/>;
    }
  };

  if (authState==="login")  return <LoginPage  t={t} onLogin={handleLogin} onSwitch={() => setAuthState("signup")}/>;
  if (authState==="signup") return <SignupPage t={t} onLogin={handleLogin} onSwitch={() => setAuthState("login")}/>;

  return (
    <div className="app-layout">
      {toastState && <Toast {...toastState} onDone={() => setToastState(null)}/>}
      <aside className={`sidebar ${collapsed?"collapsed":""}`}>
        <div className="sidebar-logo">
          <div className="logo-icon"><Icon d={icons.store} size={16} stroke="#fff"/></div>
          {!collapsed && <div><div className="logo-text">SmartStock</div><div className="logo-sub">Inventory Optimizer</div></div>}
        </div>
        <nav className="nav-items">
          {navItems.map(item => (
            <button key={item.id} className={`nav-item ${page===item.id?"active":""}`} onClick={() => setPage(item.id)}>
              <Icon d={item.icon} size={16}/>
              {!collapsed && <span>{item.label}</span>}
              {!collapsed && item.id==="alerts" && <span className="badge badge-critical" style={{ marginLeft:"auto", padding:"1px 6px", fontSize:10 }}>{[...FALLBACK_PRODUCTS.filter(p=>p.status==="critical"),...FALLBACK_PRODUCTS.filter(p=>p.status==="low")].length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-collapse-btn">
          <button className="collapse-btn" onClick={() => setCollapsed(c=>!c)}>
            <Icon d={collapsed?icons.chevronRight:icons.chevronLeft} size={14}/>
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="search-bar"><Icon d={icons.search} size={14} stroke={t.muted}/><input placeholder="Search products, SKUs…"/></div>
          <div className="topbar-actions">
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <Icon d={isDark?icons.moon:icons.sun} size={13} stroke={t.muted}/>
              <button className="toggle-track" style={{ background:isDark?t.primary:t.border }} onClick={() => setIsDark(d=>!d)}>
                <div className={`toggle-thumb ${isDark?"on":""}`}/>
              </button>
            </div>
            <button className="icon-btn"><Icon d={icons.bell} size={15}/><span className="notif-dot"/></button>
            <div className="avatar-btn">{initials}</div>
          </div>
        </header>
        <main className="page-content">{renderPage()}</main>
      </div>
      <Chatbot t={t}/>
    </div>
  );
}
