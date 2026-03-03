import { SocketProvider } from './context/SocketContext';
import { GameProvider } from './context/GameContext';
import './App.css';

export default function App() {
  return (
    <SocketProvider>
      <GameProvider>
        <div className="app">
          <h1>菜根人生</h1>
          <p>南哪大富翁 - Loading...</p>
        </div>
      </GameProvider>
    </SocketProvider>
  );
}
