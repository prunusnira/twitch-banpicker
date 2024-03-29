import { useEffect, useState } from "react";

const useSpeech = () => {
    const [voices, setVoices] = useState(new Array<SpeechSynthesisVoice>());

    useEffect(() => {
        setVoices(window.speechSynthesis.getVoices());
    }, [window.speechSynthesis]);

    const speech = (txt: string) => {
        if (!window.speechSynthesis) {
            console.log("no speech api");
            return;
        }

        const lang = "ko-KR";
        const utterThis = new SpeechSynthesisUtterance(txt);

        utterThis.onend = (event: SpeechSynthesisEvent) => {
            console.log("TTS Finish");
        };

        utterThis.onerror = (event: SpeechSynthesisEvent) => {
            console.log("TTS Error", event);
        };

        let voiceFound = false;
        for (let i = 0; i < voices.length; i++) {
            if (
                voices[i].lang.indexOf(lang) >= 0 ||
                voices[i].lang.indexOf(lang.replace("_", "-")) >= 0
            ) {
                utterThis.voice = voices[i];
                voiceFound = true;
            }
        }

        if (!voiceFound) {
            console.log("voice not found");
            return;
        }

        utterThis.lang = lang;
        utterThis.pitch = 1;
        utterThis.rate = 1; //속도
        window.speechSynthesis.speak(utterThis);
    };

    return { speech };
};

export default useSpeech;
