import { SafeImage } from "@/components/ui/SafeImage";
import { GamepadIcon } from "@/components/icons";
interface GameArtworkProps { src:string|null;alt:string;className?:string;priority?:boolean; }
function CoverPlaceholder({title}:{title:string}) {
  const hue=Array.from(title).reduce((n,c)=>n+c.charCodeAt(0),0)%360;
  return <div className="absolute inset-0 flex flex-col justify-between overflow-hidden p-6" role="img" aria-label={`${title} community cover`} style={{background:`linear-gradient(145deg,hsl(${hue} 38% 18%),hsl(${hue} 25% 9%))`}}><div className="absolute -right-16 -top-20 h-72 w-72 rounded-full border-[35px] border-white/5"/><div className="absolute -bottom-20 -left-16 h-64 w-64 rotate-45 border-[25px] border-white/5"/><div className="relative flex items-center justify-between text-[10px] font-bold uppercase tracking-[.2em] text-white/60"><span>GGz / Game Library</span><GamepadIcon size={22}/></div><p className="relative max-w-[85%] text-3xl font-black uppercase leading-none tracking-[-.04em] text-white sm:text-4xl">{title}</p><span className="relative text-[10px] font-bold uppercase tracking-[.16em] text-white/50">Find players · Build your squad</span></div>;
}
export function GameArtwork({src,alt,className="",priority=false}:GameArtworkProps) {
  const fallback=<CoverPlaceholder title={alt}/>;
  return <div className={`relative overflow-hidden bg-ggz-bg-2 ${className}`}>{src?<SafeImage src={src} alt={alt} fill sizes="(max-width:640px) 100vw,(max-width:1024px) 50vw,33vw" preload={priority} unoptimized className="object-cover transition-transform duration-500 group-hover:scale-105" fallback={fallback}/>:fallback}</div>;
}
