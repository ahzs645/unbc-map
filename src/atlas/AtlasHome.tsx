import { ArrowRight, BookOpen, Database, FileText } from "lucide-react";
import copy from "../../manifest/home.json";
import { atlasDatasets, atlasStories } from "./data";
import { atlasStoryMaps } from "./storyMaps";
import { atlasStoriesHome, atlasViewHref } from "./mode";
import "./home.css";

type Destination = "stories" | "explore" | "sources";
type Card = { title: string; description: string; detail: string; action: string };

// Topics in reading order: guided maps first, then short stories.
const topics = [...new Set([...atlasStoryMaps.map(item => item.topic), ...atlasStories.map(item => atlasDatasets.find(dataset => dataset.id === item.datasetId)?.topic)].filter((topic): topic is string => !!topic).map(topic => topic.toLowerCase()))];
const counts = { storyMaps: atlasStoryMaps.length, stories: atlasStories.length, datasets: atlasDatasets.length };
const list = (items: string[]) => items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
/**
 * manifest/home.json copy with this build's content filled in: {topics}, a
 * count such as {stories}, or a counted noun such as {stories:short story|short stories}.
 */
function fill(text: string) {
  return text.replace(/\{([^}:]+)(?::([^|}]+)\|([^}]+))?\}/g, (_, key: string, one?: string, many?: string) => {
    if (key === "topics") return list(topics);
    const count = counts[key as keyof typeof counts];
    return one && many ? `${count.toLocaleString()} ${count === 1 ? one : many}` : count.toLocaleString();
  });
}

/** The public front page (manifest: pages.home and home.json). It lists only the sections this build contains. */
export default function AtlasHome({ onNavigate }: { onNavigate: (section: Destination) => void }) {
  // A card set to null in home.json, or for a switched-off page, is left out.
  const cards = copy.cards as Record<Destination, Card | null>;
  const offered: { section: Destination; href: string; icon: typeof BookOpen; card: Card | null }[] = [
    { section: "stories", href: atlasStoriesHome, icon: BookOpen, card: cards.stories },
    ...(FLAGS.pages.explore ? [{ section: "explore" as const, href: atlasViewHref("?view=explore"), icon: Database, card: cards.explore }] : []),
    ...(FLAGS.pages.sources ? [{ section: "sources" as const, href: atlasViewHref("?view=sources"), icon: FileText, card: cards.sources }] : []),
  ];
  const destinations = offered.filter((item): item is typeof item & { card: Card } => item.card !== null);
  const follow = (event: React.MouseEvent<HTMLAnchorElement>, section: Destination) => {
    if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      onNavigate(section);
    }
  };
  const context = copy.context as typeof copy.context | null;
  return <div className="atlas-home">
    <section className={`atlas-home-intro${context ? "" : " is-single"}`} aria-labelledby="atlas-home-heading">
      <div>
        <p className="atlas-eyebrow">{fill(copy.eyebrow)}</p>
        <h2 id="atlas-home-heading">{copy.heading.map((line, index) => <span key={index}>{index > 0 && <br />}{fill(line)}</span>)}</h2>
        <p className="atlas-home-lead">{fill(copy.lead)}</p>
        {copy.body.map((paragraph, index) => <p key={index}>{fill(paragraph)}</p>)}
        <a className="atlas-home-primary" href={atlasStoriesHome} onClick={event => follow(event, "stories")}>{fill(copy.primaryAction)} <ArrowRight size={19} aria-hidden="true" /></a>
      </div>
      {context && <aside className="atlas-home-context" aria-label="About the Atlas">
        <span className="atlas-home-context-rule" aria-hidden="true" />
        <p className="atlas-eyebrow">{fill(context.eyebrow)}</p>
        <h3>{fill(context.heading)}</h3>
        <p>{fill(context.body)}</p>
        {FLAGS.pages.sources && <a href={atlasViewHref("?view=sources")} onClick={event => follow(event, "sources")}>{fill(context.link)} <ArrowRight size={17} aria-hidden="true" /></a>}
      </aside>}
    </section>
    <section className="atlas-home-destinations" aria-labelledby="atlas-home-start">
      <div className="atlas-home-section-heading"><p className="atlas-eyebrow">{fill(copy.destinations.eyebrow)}</p><h2 id="atlas-home-start">{fill(copy.destinations.heading)}</h2></div>
      <div className={`atlas-home-grid is-${destinations.length}`}>{destinations.map(({ section, href, icon: Icon, card }) => <a key={section} className="atlas-home-card" href={href} onClick={event => follow(event, section)}>
        <Icon size={27} strokeWidth={1.6} aria-hidden="true" /><h3>{fill(card.title)}</h3><p>{fill(card.description)}</p><span className="atlas-home-card-detail">{fill(card.detail)}</span><span className="atlas-home-card-action">{fill(card.action)} <ArrowRight size={18} aria-hidden="true" /></span>
      </a>)}</div>
    </section>
    {copy.note && <p className="atlas-home-note">{fill(copy.note)}</p>}
  </div>;
}
