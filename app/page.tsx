import Link from "next/link";
import Image from "next/image";
import s from "./home.module.css";
const steps = [
  ["01","Choose your tree","Choose an agarwood tree and review your care options before payment."],
  ["02","We plant and tag it","After payment approval and contract signing, the farm plants and QR-tags your tree."],
  ["03","Follow its care journey","Find approved updates under your care plan, contracts and certificates in your private account."]
];
export default function Home() {
return <main className={s.home}>
<a className={s.skip} href="#main-content">Skip to content</a>
<header className={s.header}><Link href="/" className={s.brand}><Image src="/sur-logo.png" alt="" width={32} height={40} priority/>SUR ALOESWOOD</Link><nav className={s.nav} aria-label="Main navigation"><Link href="#how-it-works">How it works</Link><Link href="/tree">Verify a tree</Link></nav><div className={s.account}><Link href="/login">Log in</Link><Link className={s.gold} href="/register">Get started</Link></div></header>
<section className={s.hero} id="main-content"><div className={s.copy}><h1>Own an <em>agarwood</em> tree.<span>We handle<br/>the care.</span></h1><p>Buy a tree, receive your contract, and follow its documented care journey—all through one private account.</p><div className={s.actions}><Link className={s.gold} href="/register">Buy your tree <span aria-hidden="true">↗</span></Link><Link className={s.outline} href="#how-it-works">See how it works</Link></div><p className={s.price}>Tree package from <strong>₱25,000</strong><br/>Care options shown before payment</p></div><div className={s.art}><div className={s.orbit} aria-hidden="true"/><figure className={s.arch}><Image src="/sur-hero-tree-v1.png" alt="Young agarwood tree with a physical identification tag" fill priority sizes="(max-width:760px) 85vw,45vw"/></figure><figure className={s.seedling}><div><Image src="/app-assets/agarwood-seedling-product-v1.png" alt="Agarwood seedling in a nursery bag" fill sizes="160px"/></div><figcaption>ONE TREE.<br/>ITS OWN IDENTITY.</figcaption></figure><p className={s.caption}>Physical roots.<br/><em>A digital record.</em></p></div></section>
<div className={s.ribbon}><span>Unique Tree ID</span><i aria-hidden="true">✦</i><span>Documented care</span><i aria-hidden="true">✦</i><span>Private records</span></div>
<section className={s.journey} id="how-it-works"><div><h2>Your tree.<br/><em>A clear journey.</em></h2><p>From choosing your tree to following its care, know what happens next.</p></div>{steps.map(([n,t,b])=><article key={n}><span>{n}</span><h3>{t}</h3><p>{b}</p></article>)}</section>
<section className={s.stories} aria-label="Care and records">{[
["CARE, ON THE GROUND","People care.","Your tree grows.","Caretakers record their work. SUR reviews the submissions and keeps approved updates organized for your account.","/sur-care-update-v1.png","Caretaker inspecting an agarwood tree","View your care records"],
["YOUR RECORDS, TOGETHER","Every tree.","Its own story.","Review your contracts, certificates and tree history. Keep a copy, or return to your private account whenever you need it.","/sur-records-v1.png","Tree ownership documents and records","Open your account"]
].map(([label,title,accent,body,img,alt,cta])=><article className={s.story} key={label}><div className={s.storyText}><span className={s.label}>{label}</span><h2>{title}<br/><em>{accent}</em></h2><p>{body}</p><Link className={s.outline} href="/login">{cta}</Link></div><div className={s.storyImage}><Image src={img} alt={alt} fill sizes="(max-width:760px) 90vw,30vw"/></div></article>)}</section>
<section className={s.cta}><span aria-hidden="true">✦</span><h2>Begin your<br/><em>tree journey.</em></h2><p>Create an account, choose your tree, and review every detail before you pay.</p><Link className={s.gold} href="/register">Create your account <span aria-hidden="true">↗</span></Link></section>
<footer className={s.footer}><p>© 2026 SUR Aloeswood<br/>Tree ownership & care records</p><nav aria-label="Footer"><Link href="/legalities">Legal library</Link><Link href="/tree">Verify a tree</Link><Link href="/investor/support">Support</Link></nav></footer>
<nav className={s.mobileNav} aria-label="Mobile navigation"><Link href="/" aria-current="page">Home</Link><Link href="/tree">Verify tree</Link><Link href="/login">Log in</Link><Link href="/register">Join</Link></nav>
</main>;
}
