# Transcript Storage Format

This directory contains raw diarization output from the audio processing pipeline. These files are the **source of truth** for chapter generation and are NOT wiki pages.

## Filename Convention

```
session-{number}-{date}.json
```

- `{number}`: Zero-padded session number (e.g., `07`, `12`)
- `{date}`: ISO date of the session in `YYYY-MM-DD` format

**Examples:**
- `session-07-2026-03-07.json`
- `session-12-2026-05-15.json`

## JSON Structure

Each transcript file contains a top-level object with two sections: `metadata` and `segments`.

```json
{
  "metadata": {
    "session_number": 7,
    "date": "2026-03-07",
    "audio_filename": "session-07-2026-03-07.wav",
    "processing_date": "2026-03-08T14:30:00Z",
    "model": "whisperx-large-v3"
  },
  "segments": [
    {
      "speaker": "SPEAKER_00",
      "start": 0.0,
      "end": 3.45,
      "text": "Okay, so you all arrive at the tavern..."
    },
    {
      "speaker": "SPEAKER_01",
      "start": 3.50,
      "end": 7.12,
      "text": "I look around the room for anything suspicious."
    }
  ]
}
```

### Metadata Fields

| Field              | Type   | Description                                      |
|--------------------|--------|--------------------------------------------------|
| `session_number`   | number | Session number matching the filename              |
| `date`             | string | ISO date of the D&D session                       |
| `audio_filename`   | string | Original audio file that was processed            |
| `processing_date`  | string | ISO 8601 timestamp of when diarization was run    |
| `model`            | string | Model identifier used for transcription           |

### Segment Fields

| Field     | Type   | Description                                      |
|-----------|--------|--------------------------------------------------|
| `speaker` | string | Speaker label assigned by diarization             |
| `start`   | number | Start time in seconds from beginning of audio     |
| `end`     | number | End time in seconds from beginning of audio       |
| `text`    | string | Transcribed text for this segment                 |

## Notes

- Speaker labels (e.g., `SPEAKER_00`) are raw diarization output. Speaker-to-character mapping is handled downstream during chapter generation.
- Segments are ordered chronologically by `start` time.
- This directory is excluded from the wiki build process and does not appear in site navigation.
