import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, updateDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { 
  Search, MapPin, Fuel, MessageCircle, AlertTriangle, 
  Share2, Navigation, Volume2, Clock, 
  ChevronRight, Filter, Zap, CheckCircle2, Car, Ban,
  Siren, Phone, Crosshair, PlusCircle, ArrowDown, Lock, RefreshCw, AlertCircle, ShieldAlert
} from 'lucide-react';

// --- Firebase Configuration (ãªé¤èÒàÃÔèÁµé¹¨Ò¡ÊÀÒ¾áÇ´ÅéÍÁ) ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'fuel-guard-th-production';

const App = () => {
  const [user, setUser] = useState(null);
  const [stations, setStations] = useState([]);
  const [selectedFuel, setSelectedFuel] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [emergencyStation, setEmergencyStation] = useState(null);
  const [userLocation, setUserLocation] = useState({ lat: 13.7563, lng: 100.5018 }); // ¾Ô¡Ñ´àÃÔèÁµé¹ ¡ÃØ§à·¾Ï
  const [locationStatus, setLocationStatus] = useState('requesting'); 
  const [isInitializing, setIsInitializing] = useState(true);

  const fuelTypes = [
    { id: 'All', label: '·Ñé§ËÁ´' },
    { id: '95', label: 'àº¹«Ô¹ 95' },
    { id: '91', label: '91' },
    { id: 'E20', label: 'E20' },
    { id: 'B7', label: '´Õà«Å B7' }
  ];

  // 1. ¿Ñ§¡ìªÑ¹¤Ó¹Ç³ÃÐÂÐ·Ò§ (Haversine Formula)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    const R = 6371; // ÃÑÈÁÕâÅ¡ (¡Á.)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(1));
  };

  // 2. ÃÐºº¨ÓÅÍ§¢éÍÁÙÅàº×éÍ§µé¹ÃÍºµÑÇ¼Ùéãªé (Seed Data)
  const seedInitialData = async (lat, lng) => {
    const mockData = [
      { name: "»µ·. ÊÒ¢ÒËÅÑ¡ (ã¡Åé¨Ø´»Ñ¨¨ØºÑ¹)", brand: "PTT", lat: lat + 0.005, lng: lng + 0.005, fuelTypes: ["95", "91", "E20", "B7"], status: "Available" },
      { name: "Shell V-Power Station", brand: "Shell", lat: lat - 0.008, lng: lng + 0.002, fuelTypes: ["95", "B7"], status: "Limited", limitAmount: "1000" },
      { name: "ºÒ§¨Ò¡ ·Ò§´èÇ¹", brand: "Bangchak", lat: lat + 0.015, lng: lng - 0.012, fuelTypes: ["95", "91", "B7"], status: "Out" },
      { name: "PT Ê¶Ò¹ÕáÂ¡¹ÃÒ", brand: "PT", lat: lat + 0.025, lng: lng + 0.010, fuelTypes: ["91", "B7"], status: "Available" }
    ];
    try {
      for (const s of mockData) {
        const newRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'stations'));
        await setDoc(newRef, { ...s, lastUpdated: serverTimestamp() });
      }
    } catch (e) { console.error("Seed Error:", e); }
  };

  // 3. ¨Ñ´¡ÒÃÃÐººÊÁÒªÔ¡áÅÐ°Ò¹¢éÍÁÙÅ Real-time
  useEffect(() => {
    const initApp = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
        
        const q = collection(db, 'artifacts', appId, 'public', 'data', 'stations');
        const snap = await getDocs(q);
        if (snap.empty) await seedInitialData(userLocation.lat, userLocation.lng);
        setIsInitializing(false);

        return onSnapshot(q, (snapshot) => {
          setStations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
      } catch (err) {
        console.error("Init Error:", err);
        setIsInitializing(false);
      }
    };
    initApp();
    const unsubAuth = onAuthStateChanged(auth, setUser);
    return () => unsubAuth();
  }, [userLocation.lat, userLocation.lng]);

  // 4. ÃÐººµÔ´µÒÁµÓáË¹è§ GPS (¾ÃéÍÁ Fallback)
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('error');
      return;
    }

    const handleSuccess = (pos) => {
      setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setLocationStatus('active');
    };

    const handleError = (err) => { 
      console.warn(`GPS Error (${err.code}): ${err.message}`);
      if (err.message.toLowerCase().includes('permissions policy') || err.code === 1) {
        setLocationStatus('policy_blocked');
      } else {
        setLocationStatus('error');
      }
    };

    const options = { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 };
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, options);
    const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, options);
    
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // 5. ÅÍ¨Ô¡¡ÒÃ¡ÃÍ§áÅÐàÃÕÂ§ÅÓ´Ñº»ÑêÁ¹éÓÁÑ¹
  const processedStations = stations
    .map(s => ({ ...s, dist: calculateDistance(userLocation.lat, userLocation.lng, s.lat, s.lng) }))
    .filter(s => {
      const matchSearch = searchTerm === '' || s.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchFuel = selectedFuel === 'All' || s.fuelTypes?.includes(selectedFuel);
      return matchSearch && matchFuel;
    })
    .sort((a, b) => a.dist - b.dist);

  const findNearest = () => {
    const target = processedStations.find(s => s.status !== 'Out');
    if (target) setEmergencyStation(target);
  };

  const updateFuelStatus = async (id, currentStatus) => {
    if (!user) return;
    const nextStatus = currentStatus === 'Out' ? 'Available' : 'Out';
    try {
      const ref = doc(db, 'artifacts', appId, 'public', 'data', 'stations', id);
      await updateDoc(ref, { 
        status: nextStatus, 
        lastUpdated: serverTimestamp() 
      });
    } catch (e) { console.error("Update Error:", e); }
  };

  if (isInitializing) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6 text-center">
        <div className="w-14 h-14 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-6 shadow-[0_0_20px_rgba(37,99,235,0.4)]"></div>
        <h2 className="text-2xl font-black italic tracking-widest uppercase">Fuel Guard</h2>
        <p className="text-slate-500 text-sm mt-2">¡ÓÅÑ§àª×èÍÁµèÍ°Ò¹¢éÍÁÙÅ»ÑêÁ¹éÓÁÑ¹...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <style>{`
        @keyframes blink { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.05); } }
        .blink-red { animation: blink 0.8s infinite; background-color: #ef4444; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Warning Banners */}
      {locationStatus === 'policy_blocked' && (
        <div className="bg-orange-600 p-2 text-[10px] font-black text-center uppercase tracking-widest flex items-center justify-center gap-2 z-[60] shadow-lg">
          <ShieldAlert className="w-3 h-3" /> GPS ¶Ù¡ºÅçÍ¡: ¡ÓÅÑ§ãªéâËÁ´¾Ô¡Ñ´ÊÓÃÍ§
        </div>
      )}
      
      {locationStatus === 'error' && (
        <div className="bg-red-600 p-2 text-[10px] font-black text-center uppercase tracking-widest flex items-center justify-center gap-2 z-[60] shadow-lg">
          <AlertCircle className="w-3 h-3" /> à¡Ô´¢éÍ¼Ô´¾ÅÒ´ GPS: â»Ã´ÃÕà¿ÃªËÃ×Íà»Ô´ÊÔ·¸Ôìà¢éÒ¶Ö§
        </div>
      )}

      {/* Emergency Nearest Modal */}
      {emergencyStation && (
        <div className="fixed inset-0 z-[100] bg-slate-950/98 backdrop-blur-2xl flex items-center justify-center p-6">
          <div className="bg-slate-900 w-full max-w-sm rounded-[3rem] border-2 border-red-500 shadow-[0_0_80px_rgba(239,68,68,0.25)] overflow-hidden">
            <div className="bg-red-600 p-10 text-center">
              <Siren className="w-20 h-20 text-white mx-auto mb-4 animate-bounce" />
              <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">¾º»ÑêÁ·Õèã¡Åé·ÕèÊØ´!</h2>
            </div>
            <div className="p-10 text-center space-y-8">
              <div className="flex justify-center">
                 <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center text-5xl font-black text-white shadow-2xl ${getBrandColor(emergencyStation.brand)}`}>
                    {emergencyStation.brand ? emergencyStation.brand[0] : 'G'}
                 </div>
              </div>
              <div>
                <h3 className="text-2xl font-black text-white leading-tight">{emergencyStation.name}</h3>
                <p className="text-blue-400 font-black text-2xl italic mt-2 underline underline-offset-8 decoration-4">ÃÐÂÐËèÒ§ {emergencyStation.dist} ¡Á.</p>
              </div>
              <button 
                className="w-full py-6 bg-white text-slate-950 rounded-3xl font-black text-xl flex items-center justify-center gap-4 active:scale-95 transition-all shadow-[0_10px_30px_rgba(255,255,255,0.1)]"
                onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${emergencyStation.lat},${emergencyStation.lng}`)}
              >
                <Navigation className="w-7 h-7 fill-current" /> ¹Ó·Ò§·Ñ¹·Õ
              </button>
              <button onClick={() => setEmergencyStation(null)} className="text-slate-500 font-black uppercase text-xs tracking-[0.2em] pt-2">Â¡àÅÔ¡</button>
            </div>
          </div>
        </div>
      )}

      {/* App Header */}
      <header className="bg-slate-900/90 backdrop-blur-xl border-b border-white/5 p-5 z-50 shadow-2xl">
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2.5 rounded-2xl shadow-lg shadow-blue-600/30"><Navigation className="w-6 h-6 text-white" /></div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter italic uppercase text-white leading-none">Fuel<span className="text-blue-500">Guard</span></h1>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Emergency Tracking System</p>
            </div>
          </div>
          <div className={`flex items-center gap-2 px-3.5 py-2 rounded-full border ${locationStatus === 'active' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-orange-500/10 border-orange-500/20 text-orange-400'}`}>
            <Crosshair className={`w-3.5 h-3.5 ${locationStatus === 'active' ? 'animate-spin' : ''}`} />
            <span className="text-[10px] font-black uppercase tracking-widest">
                {locationStatus === 'active' ? 'Live GPS' : 'Standby'}
            </span>
          </div>
        </div>

        <div className="flex gap-2.5 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-4 text-slate-500 w-5 h-5" />
            <input 
              type="text" 
              placeholder="¤é¹ËÒª×èÍ»ÑêÁ..." 
              className="w-full bg-white/5 border border-white/10 rounded-[1.25rem] py-4 pl-12 pr-5 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-white transition-all shadow-inner"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button onClick={findNearest} className="bg-red-600 px-6 rounded-[1.25rem] active:scale-95 transition-all border-b-4 border-red-800 shadow-xl shadow-red-900/30">
            <Siren className="w-6 h-6 text-white" />
          </button>
        </div>

        <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
          {fuelTypes.map(type => (
            <button 
                key={type.id} 
                onClick={() => setSelectedFuel(type.id)} 
                className={`whitespace-nowrap px-6 py-2.5 rounded-2xl text-[11px] font-black border transition-all uppercase tracking-widest ${selectedFuel === type.id ? 'bg-blue-600 border-blue-400 text-white shadow-xl shadow-blue-600/20' : 'bg-white/5 border-white/10 text-slate-500'}`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </header>

      {/* Station List Container */}
      <main className="flex-1 overflow-y-auto p-5 space-y-5 pb-40 bg-slate-950/50">
        <div className="flex items-center justify-between px-3 text-slate-500 uppercase text-[10px] font-black tracking-[0.2em] mb-2">
          <div className="flex items-center gap-2"><ArrowDown className="w-3.5 h-3.5 text-blue-500" /> »ÑêÁ·Õè¡ÓÅÑ§¨Ð¶Ö§àÃÕÂ§µÒÁÃÐÂÐ·Ò§</div>
          <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Ê´</div>
        </div>

        {processedStations.length === 0 ? (
          <div className="text-center py-24 opacity-30">
             <Fuel className="w-20 h-20 mx-auto mb-6 text-slate-700" />
             <p className="font-black uppercase tracking-widest text-sm">äÁè¾º¢éÍÁÙÅ»ÑêÁ¹éÓÁÑ¹ã¡Åé¾Ô¡Ñ´¢Í§¤Ø³</p>
          </div>
        ) : processedStations.map((station) => (
          <div key={station.id} className="bg-white/5 border border-white/10 rounded-[2.5rem] p-7 relative overflow-hidden transition-all active:bg-white/[0.08] shadow-lg group">
            <div className="flex justify-between items-start mb-6">
              <div className="flex gap-5">
                <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-3xl font-black text-white shadow-2xl ${getBrandColor(station.brand)}`}>
                  {station.brand ? station.brand[0] : 'G'}
                </div>
                <div>
                  <h3 className="font-black text-xl text-white leading-tight mb-1">{station.name}</h3>
                  <p className="text-blue-400 font-black text-base italic underline decoration-blue-500/30 underline-offset-8 tracking-tighter">ËèÒ§ {station.dist} ¡Á.</p>
                </div>
              </div>
              <div className={`px-5 py-2.5 rounded-full text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2 shadow-xl border border-white/10 ${station.status === 'Out' ? 'blink-red' : (station.status === 'Limited' ? 'bg-orange-500' : 'bg-green-500')}`}>
                {station.status === 'Out' ? <Ban className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {station.status === 'Out' ? '¹éÓÁÑ¹ËÁ´' : (station.status === 'Limited' ? `¨Ó¡Ñ´ ${station.limitAmount}.-` : 'ÁÕ¹éÓÁÑ¹')}
              </div>
            </div>

            <div className="flex gap-2.5 mb-7 overflow-x-auto no-scrollbar">
              {station.fuelTypes?.map(f => (
                <span key={f} className={`text-[10px] font-black px-4 py-2 rounded-xl border transition-all ${selectedFuel === f ? 'bg-blue-600/20 border-blue-500/50 text-blue-400' : 'bg-slate-900/50 border-white/5 text-slate-600'}`}>
                  {f}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button 
                className="bg-white text-slate-950 py-4.5 rounded-[1.25rem] font-black text-base flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl hover:bg-slate-100"
                onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`)}
              >
                <Navigation className="w-5 h-5 fill-current" /> ¹Ó·Ò§
              </button>
              <button onClick={() => updateFuelStatus(station.id, station.status)} className="bg-slate-800 border border-white/5 text-slate-400 py-4.5 rounded-[1.25rem] font-black text-[10px] uppercase flex items-center justify-center gap-3 active:bg-red-600 active:text-white transition-all group">
                <AlertTriangle className="w-5 h-5 group-active:animate-bounce" /> ÍÑ»à´µÊ¶Ò¹Ð
              </button>
            </div>
          </div>
        ))}
      </main>

      {/* Floating Action Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 p-8 bg-slate-950/80 backdrop-blur-3xl border-t border-white/5 flex gap-5 z-50 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.6)]">
        <button onClick={findNearest} className="flex-[4] bg-red-600 text-white py-6 rounded-[2.5rem] font-black text-xl shadow-2xl shadow-red-600/50 flex items-center justify-center gap-4 active:scale-95 transition-all border-b-4 border-red-800 relative group overflow-hidden uppercase italic tracking-tighter">
          <div className="absolute inset-0 bg-white/10 opacity-0 group-active:opacity-100 transition-opacity"></div>
          <Siren className="w-9 h-9 group-hover:animate-bounce" /> 
          <span>ªèÇÂËÒ»ÑêÁ´èÇ¹!</span>
        </button>
        <button className="flex-1 bg-white/5 text-white rounded-[2.5rem] flex flex-col items-center justify-center border border-white/10 active:bg-white/20 transition-all shadow-xl">
          <PlusCircle className="w-7 h-7 text-blue-500" />
          <span className="text-[9px] font-black uppercase mt-1 tracking-tighter">á¨é§»ÑêÁ</span>
        </button>
      </nav>
    </div>
  );
};

// ªèÇÂàÅ×Í¡ÊÕµÒÁáºÃ¹´ì
const getBrandColor = (brand) => {
  switch(brand) {
    case 'PTT': return 'bg-blue-600';
    case 'Shell': return 'bg-yellow-500';
    case 'PT': return 'bg-green-600';
    case 'Bangchak': return 'bg-emerald-500';
    case 'Caltex': return 'bg-red-600';
    default: return 'bg-slate-700';
  }
};

export default App;
