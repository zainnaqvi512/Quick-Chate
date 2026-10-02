const EMOJI_DATA: { label: string; emojis: string[] }[] = [
  {
    label: "Smileys",
    emojis: "😀 😃 😄 😁 😆 😅 🤣 😂 🙂 😉 😊 😇 🥰 😍 🤩 😘 😗 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 🤯 🤠 🥳 🥸 😎 🤓 🧐 😕 😟 🙁 ☹️ 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱".split(" "),
  },
  {
    label: "People",
    emojis: "👋 🤚 🖐 ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 🖕 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 💪 🦾 🦵 🦶 👶 🧒 👦 👧 🧑 👱 👨 🧔 👩 🧓 👴 👵 🙍 🙎 🙅 🙆 💁 🙋 🧏 🙇 🤦 🤷".split(" "),
  },
  {
    label: "Animals",
    emojis: "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐒 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🐛 🦋 🐌 🐞 🐜 🪲 🐢 🐍 🦎 🦂 🦀 🐙 🦑 🦐 🐠 🐟 🐬 🐳 🐋 🦈".split(" "),
  },
  {
    label: "Food",
    emojis: "🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🍆 🥑 🥦 🥬 🥒 🌶 🌽 🥕 🫒 🧄 🧅 🥔 🍠 🥐 🥯 🍞 🥖 🥨 🧀 🥚 🍳 🧈 🥞 🧇 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🍿".split(" "),
  },
  {
    label: "Travel",
    emojis: "🚗 🚕 🚙 🚌 🚎 🏎 🚓 🚑 🚒 🚐 🛻 🚚 🚛 🚜 🦯 🦽 🦼 🛴 🚲 🛵 🏍 🛺 🚨 🚔 🚍 🚘 🚖 🚡 🚠 🚟 🚃 🚋 🚞 🚝 🚄 🚅 🚈 🚂 🚆 🚇 🚊 🚉 ✈️ 🛫 🛬 🛩 💺 🛰 🚀 🛸 🚁".split(" "),
  },
  {
    label: "Activities",
    emojis: "⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🎱 🪀 🏓 🏸 🏒 🏑 🥍 🏏 🪃 🥅 ⛳ 🪁 🏹 🎣 🤿 🥊 🥋 🎽 🛹 🛼 🛷 ⛸ 🥌 🎿 ⛷ 🏂 🪂 🏋️ 🤼 🤸 ⛹️ 🤺 🤾 🏌️ 🏇 🧘 🏄 🏊 🤽 🚣 🧗 🚵".split(" "),
  },
  {
    label: "Objects",
    emojis: "⌚ 📱 📲 💻 ⌨️ 🖥 🖨 🖱 🖲 🕹 🗜 💽 💾 💿 📀 📼 📷 📸 📹 🎥 📽 🎞 📞 ☎️ 📟 📠 📺 📻 🎙 🎚 🎛 🧭 ⏱ ⏲ ⏰ 🕰 ⌛ ⏳ 📡 🔋 🔌 💡 🔦 🕯 🪔 🧯 🛢 💸 💵 💴 💶 💷 💰 💳".split(" "),
  },
  {
    label: "Symbols",
    emojis: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ☮️ ✝️ ☪️ 🕉 ☸️ ✡️ 🔯 🕎 ☯️ ☦️ 🛐 ⛎ ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ 🆔 ⚛️ 🉑 ☢️ ☣️ 📴 📳 🈶 🈚 🈸 🈺 🈷️ ✴️ 🆚 💯".split(" "),
  },
  {
    label: "Flags",
    emojis: "🏳️ 🏴 🏁 🚩 🏳️‍🌈 🏳️‍⚧️ 🇵🇰 🇺🇸 🇬🇧 🇮🇳 🇨🇳 🇦🇪 🇸🇦 🇹🇷 🇩🇪 🇫🇷 🇪🇸 🇮🇹 🇧🇷 🇮🇩 🇧🇩 🇳🇬 🇪🇬 🇷🇺 🇯🇵 🇰🇷 🇦🇺 🇨🇦 🇲🇽 🇿🇦 🇲🇾 🇵🇭 🇸🇬 🇹🇭 🇻🇳 🇳🇱".split(" "),
  },
];

export function EmojiPicker({ onPick }: { onPick: (e: string) => void }) {
  return (
    <div className="w-72" role="dialog" aria-label="Emoji picker">
      <div className="max-h-64 overflow-y-auto p-2 space-y-2">
        {EMOJI_DATA.map((cat) => (
          <div key={cat.label}>
            <p className="text-[11px] font-medium text-muted-foreground px-1 pb-1">{cat.label}</p>
            <div className="grid grid-cols-8">
              {cat.emojis.map((e) => (
                <button
                  key={e}
                  className="text-xl p-1 rounded hover:bg-accent transition-colors"
                  onClick={() => onPick(e)}
                  aria-label={e}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const QUICK_REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "🙏"];

const STICKER_PACKS: { name: string; stickers: string[] }[] = [
  { name: "Moods", stickers: ["😎", "🥳", "🤯", "😴", "🤗", "😭", "🥺", "🤪", "😇", "🤠", "🥶", "🤩"] },
  { name: "Gestures", stickers: ["👍", "👎", "👏", "🙌", "🤝", "✌️", "🤞", "💪", "🙏", "👋", "🫶", "✊"] },
  { name: "Hearts", stickers: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💖", "💝", "💘", "💯"] },
  { name: "Party", stickers: ["🎉", "🎊", "🎈", "🎂", "🍾", "🥂", "🎁", "🪩", "🎵", "🎶", "🔥", "✨"] },
];

const RECENT_KEY = "quickchat.recentStickers";
const FAV_KEY = "quickchat.favStickers";

export function StickersPanel({ onPick }: { onPick: (s: string) => void }) {
  const recent: string[] = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  const favs: string[] = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");

  function pick(s: string) {
    const next = [s, ...recent.filter((x) => x !== s)].slice(0, 12);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    onPick(s);
  }
  function toggleFav(s: string) {
    const next = favs.includes(s) ? favs.filter((x) => x !== s) : [s, ...favs].slice(0, 24);
    localStorage.setItem(FAV_KEY, JSON.stringify(next));
  }

  const Section = ({ title, items }: { title: string; items: string[] }) =>
    items.length === 0 ? null : (
      <div>
        <p className="text-[11px] font-medium text-muted-foreground px-1 pb-1">{title}</p>
        <div className="grid grid-cols-6 gap-1">
          {items.map((s) => (
            <button
              key={s}
              className="text-3xl p-1.5 rounded-lg hover:bg-accent transition-colors"
              onClick={() => pick(s)}
              onContextMenu={(e) => {
                e.preventDefault();
                toggleFav(s);
              }}
              aria-label={`Sticker ${s}`}
              title="Click to send, right-click to favorite"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    );

  return (
    <div className="w-72 max-h-72 overflow-y-auto p-2 space-y-2" role="dialog" aria-label="Sticker picker">
      <Section title="Recent" items={recent} />
      <Section title="Favorites" items={favs} />
      {STICKER_PACKS.map((p) => (
        <Section key={p.name} title={p.name} items={p.stickers} />
      ))}
    </div>
  );
}
