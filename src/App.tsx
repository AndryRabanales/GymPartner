import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { APIProvider } from '@vis.gl/react-google-maps';
import { AppLayout } from './layouts/AppLayout';
import { UserProfile } from './pages/UserProfile';
import { LoginPage } from './pages/LoginPage';
import { MapPage } from './pages/MapPage';
import { MyArsenal } from './pages/MyArsenal';
import { WorkoutSession } from './pages/WorkoutSession';
import { GymProfile } from './pages/GymProfile';
import { RoutineBuilder } from './pages/RoutineBuilder';
import { StatsPage } from './pages/StatsPage';
import { HistoryPage } from './pages/HistoryPage';
import WorkoutDetailPage from './pages/WorkoutDetailPage';
import { RankingPage } from './pages/RankingPage';
import { CommunityPage } from './pages/CommunityPage';
import { ReelsPage } from './pages/ReelsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { Radar } from './pages/Radar';
import { ChatPage } from './pages/ChatPage';
import { BottomNavProvider } from './context/BottomNavContext';




function App() {
  return (
    <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}>
      <BottomNavProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<UserProfile />} />
              <Route path="reels" element={<ReelsPage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="map" element={<MapPage />} />
              <Route path="arsenal" element={<MyArsenal />} />
              <Route path="workout" element={<WorkoutSession />} />
              <Route path="profile" element={<UserProfile />} />
              <Route path="territory/:gymId" element={<GymProfile />} />
              <Route path="builder" element={<RoutineBuilder />} />
              <Route path="ranking" element={<RankingPage />} />
              <Route path="community" element={<CommunityPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="stats" element={<StatsPage />} />
              <Route path="radar" element={<Radar />} />
              <Route path="chat/:chatId" element={<ChatPage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="history/:sessionId" element={<WorkoutDetailPage />} />
              <Route path="territory/:gymId/arsenal" element={<MyArsenal />} />
              <Route path="territory/:gymId/workout" element={<WorkoutSession />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </BottomNavProvider>
    </APIProvider>
  );
}

export default App;
