/// <reference lib="dom" />

const PORT = 6587;
const playerBar = document.querySelector("ytmusic-player-bar");

function timestampToSeconds(timestamp) {
  const [minutes, seconds] = timestamp.split(":").map((x) => parseInt(x, 10));
  return minutes * 60 + seconds;
}

function getNowPlaying() {
  const outer = playerBar.querySelector(
    "yt-formatted-string.byline.ytmusic-player-bar.complex-string",
  );
  if (!outer) return null;
  const thumbnail = playerBar.querySelector("img.ytmusic-player-bar").src;
  const title = playerBar.querySelector(
    "yt-formatted-string.title.ytmusic-player-bar",
  ).innerHTML;
  const items = outer.querySelectorAll(
    "a.yt-simple-endpoint.yt-formatted-string",
  );
  const artist = items.item(0).innerHTML;
  const album = items.item(1).innerHTML;

  const leftControls = playerBar.querySelector(
    ".left-controls",
  );
  const playPauseButton = leftControls.querySelector("#play-pause-button");
  const isPlaying = playPauseButton.getAttribute("aria-label") === "Pause";
  const [elapsed, total] = leftControls.querySelector(
    "span.time-info.ytmusic-player-bar",
  )
    .innerHTML.trim().split(" / ");

  const listItem = document.querySelector(
    `ytmusic-responsive-list-item-renderer.ytmusic-playlist-shelf-renderer[play-button-state="playing"]`,
  ) || document.querySelector(
    `ytmusic-responsive-list-item-renderer.ytmusic-playlist-shelf-renderer[play-button-state="paused"]`,
  );

  let url;

  if (listItem) {
    const el = listItem.querySelector(
      "yt-formatted-string.title.ytmusic-responsive-list-item-renderer",
    );
    if (el) {
      const a = el.querySelector("a");
      if (a) {
        url = a.href;
      }
    }
  }

  return {
    thumbnail,
    title,
    artist,
    album,
    isPlaying,
    elapsed: timestampToSeconds(elapsed),
    total: timestampToSeconds(total),
    url,
  };
}

function compareActivity(a, b) {
  if (a.isPlaying !== b.isPlaying) return false;
  else if (a.thumbnail !== b.thumbnail) return false;
  else if (a.url !== b.url) return false;
  else if (a.title !== b.title) return false;
  else if (a.artist !== b.artist) return false;
  else if (a.album !== b.album) return false;
  // We don't care about the elapsed time, we're not gonna send
  // updates every second... it's used just once to calculate
  // end timestamp.
  else return true;
}

let isSet = false;

async function setActivity(activity) {
  isSet = true;
  console.log(
    "[Discord Rich Presence] [YouTube Music] Setting activity:",
    activity,
  );
  return await fetch(`http://localhost:${PORT}/activity`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(activity),
  }).then(async (res) => {
    if (!res.ok) {
      throw new Error(`Failed to set activity: ${await res.text()}`);
    }
    return await res.json();
  });
}

async function clearActivity() {
  if (!isSet) return;
  isSet = false;
  console.log("[Discord Rich Presence] [YouTube Music] Clearing activity");
  const res = await fetch(`http://localhost:${PORT}/activity`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error("Failed to clear activity");
  }
}

let lastActivity = null;

function updateActivity() {
  const activity = getNowPlaying();
  if (!activity) {
    clearActivity();
    return;
  }
  if (lastActivity && compareActivity(lastActivity, activity)) {
    return;
  }
  lastActivity = activity;
  setActivity(transformMusicActivity(activity));
}

function transformMusicActivity(data) {
  return {
    details: data.title,
    state: data.artist,
    timestamps: data.isPlaying && !isNaN(data.elapsed) && !isNaN(data.total)
      ? {
        end: Date.now() + (data.total - data.elapsed) * 1000,
      }
      : undefined,
    assets: {
      large_image: data.thumbnail,
      large_text: data.album,
      small_image: "icon",
      small_text: data.isPlaying ? "Playing" : "Paused",
    },
    buttons: data.url
      ? [
        {
          label: "Listen on YouTube Music",
          url: data.url,
        },
      ]
      : undefined,
  };
}

const observer = new MutationObserver(updateActivity);

observer.observe(playerBar, {
  childList: true,
  subtree: true,
  attributes: true,
});

console.log("[Discord Rich Presence] [YouTube Music] Started Observer!");
