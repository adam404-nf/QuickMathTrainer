import { PracticePage } from "./routes/PracticePage";
import { AppProviders } from "./providers";

export function App() {
  return (
    <AppProviders>
      <PracticePage />
    </AppProviders>
  );
}
