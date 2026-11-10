import { useGame } from './store/useGameStore'
import { HomeScreen } from './components/screens/HomeScreen'
import { SetupScreen } from './components/screens/SetupScreen'
import { GarageScreen } from './components/screens/GarageScreen'
import { RaceScreen } from './components/race/RaceScreen'

export default function App() {
  const screen = useGame((s) => s.screen)
  switch (screen) {
    case 'setup':
      return <SetupScreen />
    case 'garage':
      return <GarageScreen />
    case 'race':
      return <RaceScreen />
    default:
      return <HomeScreen />
  }
}
