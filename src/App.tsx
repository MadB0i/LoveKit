import { HashRouter, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Capsules from './pages/Capsules';
import Cards from './pages/Cards';
import Coupons from './pages/Coupons';
import Games from './pages/Games';
import Home from './pages/Home';
import Memories from './pages/Memories';
import NotFound from './pages/NotFound';
import Privacy from './pages/Privacy';
import Receive from './pages/Receive';
import Stickers from './pages/Stickers';
import KnowMe from './pages/games/KnowMe';
import ThisOrThat from './pages/games/ThisOrThat';
import WhoSaidIt from './pages/games/WhoSaidIt';

/**
 * HashRouter: share links (`#/l/<code>`) and deep links work on any static
 * host with zero server rewrites — GitHub Pages, Netlify Drop, file://, …
 */
export default function App(): React.ReactElement {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="cards" element={<Cards />} />
          <Route path="cards/:id" element={<Cards />} />
          <Route path="stickers" element={<Stickers />} />
          <Route path="games" element={<Games />} />
          <Route path="games/know-me" element={<KnowMe />} />
          <Route path="games/who-said-it" element={<WhoSaidIt />} />
          <Route path="games/this-or-that" element={<ThisOrThat />} />
          <Route path="memories" element={<Memories />} />
          <Route path="coupons" element={<Coupons />} />
          <Route path="capsules" element={<Capsules />} />
          <Route path="l/:code" element={<Receive />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
