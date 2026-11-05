import Image from "next/image";
import agentMarket from "../../../public/images/agente-mercado-ukuphila.png";

export function AgentMarketPhoto({ preload = false }: { preload?: boolean }) {
  return <figure className="agent-market-photo"><Image src={agentMarket} alt="Um agente moçambicano de colete Ukuphila apoia uma comerciante com o telemóvel na sua banca de legumes." fill sizes="(max-width: 760px) calc(100vw - 32px), (max-width: 1200px) 52vw, 650px" placeholder="blur" preload={preload} /></figure>;
}
