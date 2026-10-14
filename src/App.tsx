import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';

type Mode = 'focus' | 'shortBreak' | 'longBreak';

interface Settings {
  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  longBreakInterval: number;
}

interface FocusSession {
  date: string;
  duration: number;
  completedAt: number;
}

const defaultSettings: Settings = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  longBreakInterval: 4,
};

const modeLabels: Record<Mode, string> = {
  focus: 'Focus',
  shortBreak: 'Short Break',
  longBreak: 'Long Break',
};

const modeColors: Record<Mode, { bg: string; ring: string; text: string; btn: string; btnHover: string }> = {
  focus: {
    bg: 'bg-red-50',
    ring: 'stroke-red-500',
    text: 'text-red-600',
    btn: 'bg-red-500',
    btnHover: 'hover:bg-red-600',
  },
  shortBreak: {
    bg: 'bg-emerald-50',
    ring: 'stroke-emerald-500',
    text: 'text-emerald-600',
    btn: 'bg-emerald-500',
    btnHover: 'hover:bg-emerald-600',
  },
  longBreak: {
    bg: 'bg-blue-50',
    ring: 'stroke-blue-500',
    text: 'text-blue-600',
    btn: 'bg-blue-500',
    btnHover: 'hover:bg-blue-600',
  },
};

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

export default function App() {
  const [settings, setSettings] = useLocalStorage<Settings>('pomodoro-settings', defaultSettings);
  const [sessions, setSessions] = useLocalStorage<FocusSession[]>('pomodoro-sessions', []);
  const [completedPomodoros, setCompletedPomodoros] = useLocalStorage<number>('pomodoro-count', 0);

  const [mode, setMode] = useState<Mode>('focus');
  const [timeLeft, setTimeLeft] = useState(settings.focusDuration * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const settingsRef = useRef(settings);
  const modeRef = useRef(mode);
  const completedRef = useRef(completedPomodoros);

  // Keep refs in sync
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { completedRef.current = completedPomodoros; }, [completedPomodoros]);

  const totalDuration = (() => {
    switch (mode) {
      case 'focus': return settings.focusDuration * 60;
      case 'shortBreak': return settings.shortBreakDuration * 60;
      case 'longBreak': return settings.longBreakDuration * 60;
    }
  })();

  const progress = 1 - timeLeft / totalDuration;

  // Timer logic
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            setIsRunning(false);

            const currentMode = modeRef.current;
            const currentSettings = settingsRef.current;
            const currentCount = completedRef.current;

            if (currentMode === 'focus') {
              // Record session
              const session: FocusSession = {
                date: getToday(),
                duration: currentSettings.focusDuration,
                completedAt: Date.now(),
              };
              setSessions((prev) => [...prev, session]);
              setCompletedPomodoros((prev) => prev + 1);

              // Auto-switch to break
              const newCount = currentCount + 1;
              if (newCount % currentSettings.longBreakInterval === 0) {
                setMode('longBreak');
                return currentSettings.longBreakDuration * 60;
              } else {
                setMode('shortBreak');
                return currentSettings.shortBreakDuration * 60;
              }
            } else {
              // After break, switch to focus
              setMode('focus');
              return currentSettings.focusDuration * 60;
            }
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, setSessions, setCompletedPomodoros]);

  const handleStart = () => setIsRunning(true);
  const handlePause = () => setIsRunning(false);

  const handleReset = useCallback(() => {
    setIsRunning(false);
    switch (mode) {
      case 'focus': setTimeLeft(settings.focusDuration * 60); break;
      case 'shortBreak': setTimeLeft(settings.shortBreakDuration * 60); break;
      case 'longBreak': setTimeLeft(settings.longBreakDuration * 60); break;
    }
  }, [mode, settings]);

  const handleModeChange = (newMode: Mode) => {
    setIsRunning(false);
    setMode(newMode);
    switch (newMode) {
      case 'focus': setTimeLeft(settings.focusDuration * 60); break;
      case 'shortBreak': setTimeLeft(settings.shortBreakDuration * 60); break;
      case 'longBreak': setTimeLeft(settings.longBreakDuration * 60); break;
    }
  };

  const handleSkip = () => {
    setIsRunning(false);
    if (mode === 'focus') {
      const newCount = completedPomodoros + 1;
      if (newCount % settings.longBreakInterval === 0) {
        handleModeChange('longBreak');
      } else {
        handleModeChange('shortBreak');
      }
    } else {
      handleModeChange('focus');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Statistics
  const todaySessions = sessions.filter((s) => s.date === getToday());
  const todayFocusMinutes = todaySessions.reduce((acc, s) => acc + s.duration, 0);
  const todayPomodoros = todaySessions.length;

  // Circle SVG
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const colors = modeColors[mode];

  return (
    <div className={`min-h-screen ${colors.bg} transition-colors duration-500 flex flex-col`}>
      {/* Header */}
      <header className="p-4 flex justify-between items-center max-w-2xl mx-auto w-full">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <span className="text-2xl">🍅</span> Pomodoro
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowStats(!showStats); setShowSettings(false); }}
            className="p-2 rounded-lg bg-white/70 hover:bg-white shadow-sm transition-all text-gray-600 hover:text-gray-800"
            title="Statistics"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </button>
          <button
            onClick={() => { setShowSettings(!showSettings); setShowStats(false); }}
            className="p-2 rounded-lg bg-white/70 hover:bg-white shadow-sm transition-all text-gray-600 hover:text-gray-800"
            title="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
        {/* Mode Selector */}
        <div className="flex gap-2 mb-8 bg-white/70 backdrop-blur-sm p-1.5 rounded-xl shadow-sm">
          {(['focus', 'shortBreak', 'longBreak'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => handleModeChange(m)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === m
                  ? `${modeColors[m].btn} text-white shadow-md`
                  : 'text-gray-600 hover:bg-white/50'
              }`}
            >
              {modeLabels[m]}
            </button>
          ))}
        </div>

        {/* Timer Circle */}
        <div className="relative mb-8">
          <svg width="280" height="280" className="transform -rotate-90">
            <circle
              cx="140"
              cy="140"
              r={radius}
              fill="none"
              stroke="currentColor"
              className="text-gray-200"
              strokeWidth="8"
            />
            <circle
              cx="140"
              cy="140"
              r={radius}
              fill="none"
              className={`${colors.ring} transition-all duration-1000`}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-5xl font-mono font-bold ${colors.text} transition-colors duration-500`}>
              {formatTime(timeLeft)}
            </span>
            <span className="text-sm text-gray-500 mt-2 font-medium uppercase tracking-wide">
              {modeLabels[mode]}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={handleReset}
            className="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center text-gray-500 hover:text-gray-700 hover:shadow-lg transition-all active:scale-95"
            title="Reset"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          <button
            onClick={isRunning ? handlePause : handleStart}
            className={`w-16 h-16 rounded-full ${colors.btn} ${colors.btnHover} shadow-lg flex items-center justify-center text-white transition-all hover:shadow-xl hover:scale-105 active:scale-95`}
            title={isRunning ? 'Pause' : 'Start'}
          >
            {isRunning ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 9v6m4-6v6" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button
            onClick={handleSkip}
            className="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center text-gray-500 hover:text-gray-700 hover:shadow-lg transition-all active:scale-95"
            title="Skip"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Pomodoro Counter Dots */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Session progress:</span>
          <div className="flex gap-1.5">
            {Array.from({ length: settings.longBreakInterval }).map((_, i) => (
              <div
                key={i}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${
                  i < (todayPomodoros % settings.longBreakInterval)
                    ? `${colors.btn} scale-100`
                    : 'bg-gray-200 scale-90'
                }`}
              />
            ))}
          </div>
          <span className="font-medium ml-1">{todayPomodoros} done</span>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mt-8 w-full max-w-md bg-white rounded-2xl shadow-lg p-6 animate-fadeIn">
            <h2 className="text-lg font-bold text-gray-800 mb-4">⚙️ Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Focus Duration (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={settings.focusDuration}
                  onChange={(e) => {
                    const val = Math.max(1, Math.min(120, parseInt(e.target.value) || 1));
                    setSettings({ ...settings, focusDuration: val });
                    if (mode === 'focus' && !isRunning) setTimeLeft(val * 60);
                  }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Short Break (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={settings.shortBreakDuration}
                  onChange={(e) => {
                    const val = Math.max(1, Math.min(30, parseInt(e.target.value) || 1));
                    setSettings({ ...settings, shortBreakDuration: val });
                    if (mode === 'shortBreak' && !isRunning) setTimeLeft(val * 60);
                  }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Long Break (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={settings.longBreakDuration}
                  onChange={(e) => {
                    const val = Math.max(1, Math.min(60, parseInt(e.target.value) || 1));
                    setSettings({ ...settings, longBreakDuration: val });
                    if (mode === 'longBreak' && !isRunning) setTimeLeft(val * 60);
                  }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Long Break After (pomodoros)
                </label>
                <input
                  type="number"
                  min="2"
                  max="10"
                  value={settings.longBreakInterval}
                  onChange={(e) => {
                    const val = Math.max(2, Math.min(10, parseInt(e.target.value) || 2));
                    setSettings({ ...settings, longBreakInterval: val });
                  }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 transition-all"
                />
              </div>
              <button
                onClick={() => {
                  setSettings(defaultSettings);
                  handleModeChange(mode);
                }}
                className="text-sm text-gray-500 hover:text-gray-700 underline transition-colors"
              >
                Reset to defaults
              </button>
            </div>
          </div>
        )}

        {/* Statistics Panel */}
        {showStats && (
          <div className="mt-8 w-full max-w-md bg-white rounded-2xl shadow-lg p-6 animate-fadeIn">
            <h2 className="text-lg font-bold text-gray-800 mb-4">📊 Today's Statistics</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-red-50 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-red-600">{todayPomodoros}</p>
                <p className="text-xs text-gray-500 mt-1">Pomodoros</p>
              </div>
              <div className="bg-orange-50 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-orange-600">{todayFocusMinutes}</p>
                <p className="text-xs text-gray-500 mt-1">Minutes Focused</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-purple-600">{(todayFocusMinutes / 60).toFixed(1)}</p>
                <p className="text-xs text-gray-500 mt-1">Hours Focused</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-blue-600">{sessions.length}</p>
                <p className="text-xs text-gray-500 mt-1">All-Time Sessions</p>
              </div>
            </div>
            {todaySessions.length > 0 && (
              <div className="mt-5">
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Recent Sessions</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {[...todaySessions].reverse().slice(0, 10).map((session, i) => (
                    <div key={i} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2.5">
                      <span className="text-gray-600">🍅 {session.duration} min focus</span>
                      <span className="text-gray-400 text-xs font-mono">
                        {new Date(session.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {todaySessions.length === 0 && (
              <p className="mt-4 text-center text-sm text-gray-400">No sessions yet today. Start your first pomodoro!</p>
            )}
            <button
              onClick={() => {
                if (confirm('Clear all statistics? This cannot be undone.')) {
                  setSessions([]);
                  setCompletedPomodoros(0);
                }
              }}
              className="mt-4 text-sm text-red-400 hover:text-red-600 underline transition-colors"
            >
              Clear all data
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-xs text-gray-400">
        Stay focused. Take breaks. Be productive.
      </footer>
    </div>
  );
}
