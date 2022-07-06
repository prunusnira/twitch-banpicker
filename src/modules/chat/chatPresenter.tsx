import React from "react";

import "./chat.css";
import { ChatContainer } from "./chat.style";

interface Props {
    username: string;
}

const ChatPresenter = ({ username }: Props) => {
    const baseUrl: string = "https://www.twitch.tv/embed/";
    const baseUrl2: string = "/chat?parent=banpick.nira.one";

    return (
        <ChatContainer>
            <iframe frameBorder="0" src={`${baseUrl}${username}${baseUrl2}`} />
        </ChatContainer>
    );
};

export default ChatPresenter;