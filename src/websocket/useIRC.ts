import { useCallback, useEffect, useState } from "react";
import { useRef } from "react";
import { useSelector } from "react-redux";
import Message, { emptyMessage, getFormatDate } from "../data/message";
import { Observer, Subject } from "../data/observer/observer";
import Parser from "../data/parser";
import User, { emptyUser } from "../data/user";
import requestUserProfile from "../data/userProfile";
import { IBanpickData } from "../modules/main/useBanpickData";
import Team from "../data/team";
import { RootState } from "../redux/reducer";
import useTTS from "../tts/useTTS";

type Props = {
    banpickData: IBanpickData;
    hasUser: (teamNum: number, id: string) => Promise<boolean>;
    removeUser: (teamNum: number, id: string) => Promise<void>;
    addUser: (teamNum: number, user: User) => Promise<void>;
    getUser: (id: string) => Promise<User>;
    updateUser: (user: User) => Promise<void>;
    getTeamInfo: (teamNum: number) => Promise<Team>;
    setTeamInfo: (teamNum: number, team: Team) => void;

    picked: User;
    chatList: Array<Message>;
    setChatList: (l: Array<Message>) => void;
    setDlgUser: (b: boolean) => void;
};

const useIRC = ({
    banpickData,
    hasUser,
    removeUser,
    addUser,
    getUser,
    updateUser,
    getTeamInfo,
    setTeamInfo,

    picked,
    chatList,
    setChatList,
    setDlgUser,
}: Props) => {
    const socket = useRef<WebSocket>(new WebSocket(process.env.REACT_APP_URL_IRC!));
    const subject = useRef<Subject>(new Subject());
    const { acctok, loginName, clientId } = useSelector((state: RootState) => state.user);
    const { allPick, turnPick, turnBan, isStarted, isEntering, isNegoMode, phase } = banpickData;

    const { speech } = useTTS();

    useEffect(() => {
        socket.current.onopen = onSocketOpen;
        socket.current.onmessage = onMsgReceived;
        socket.current.onerror = onError;
        socket.current.onclose = onSocketClose;
    }, []);

    useEffect(() => {
        subject.current.setFunction(processMessage);
    }, [isStarted, picked, chatList]);

    const onSocketOpen = (ev: Event) => {
        console.log("IRC Connected " + ev.returnValue);
        connect();
    };

    const connect = () => {
        socket.current.send("CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership");
        socket.current.send("PASS oauth:" + acctok);
        socket.current.send("NICK " + loginName.toLowerCase());
        socket.current.send("JOIN #" + loginName.toLowerCase());
    };

    const onMsgReceived = (ev: MessageEvent) => {
        console.log(`messge get ${ev.data}`);
        if (ev.data !== undefined) {
            const msg: string = ev.data;

            // 채팅 메시지 처리하기
            if (msg.startsWith("PING :tmi.twitch.tv")) {
                socket.current.send("PONG :tmi.twitch.tv");
                return;
            }

            if (msg.startsWith("@")) {
                subject.current.updateMessage(msg);
                subject.current.notify();
            }
        }
    };

    const onError = (ev: Event) => {
        console.log("Error " + ev.returnValue);
    };

    const onSocketClose = (ev: CloseEvent) => {
        console.log("WS Closed: " + ev.code);
    };

    const registerObserver = (observer: Observer) => {
        subject.current.attach(observer);
    };

    const processMessage = async (msg: string) => {
        if (!isStarted) return;

        const msgParsed = Parser.parse(msg);

        if (msgParsed.size > 0) {
            // 뱃지 검사해서 subscriber 확인
            const badges = msgParsed.get("badges")!.split(",");
            let isSub = false;
            badges.forEach((v) => {
                if (v.startsWith("subscriber")) {
                    isSub = true;
                }
            });

            const msg: Message = {
                id: msgParsed.get("userid")!,
                name: msgParsed.get("display-name")!,
                msg: msgParsed.get("msg")!,
                ban: false,
                time: Date.now(),
                timeInTxt: getFormatDate(Date.now()),
            };

            let user = await getUser(msg.id);
            console.log(msg.id);
            console.log(user);
            // 소속 팀 유무 확인
            if (user.id === "") {
                console.log("// new user");
                user = {
                    id: msgParsed.get("userid")!,
                    name: msgParsed.get("display-name")!,
                    subs: isSub,
                    profileUrl: "",
                    picked: false,
                    lastChat: emptyMessage,
                };
            }

            // 프로필 이미지 가져오기 (없을 때)
            if (user.profileUrl === "") {
                await requestUserProfile(user!.id, acctok, clientId, (map) => {
                    user.profileUrl = map.get("profile_image_url")!;
                });
            }

            // 해당 유저의 최종 채팅 변경
            user.lastChat = msg;

            // 팀 등록
            if (isEntering && (msg.msg.startsWith("!team ") || msg.msg.startsWith("!팀 "))) {
                const teamNum = msg.msg.split(" ")[1].split("\r\n")[0];

                // 이미 다른 팀에 들어가있다면 삭제함
                teamNum === "1" && removeUser(2, msg.id);
                teamNum === "2" && removeUser(1, msg.id);

                if (teamNum === "1") {
                    console.log(msg.id + "가 팀 " + teamNum + "으로 등록");
                    addUser(1, user);
                } else if (teamNum === "2") {
                    console.log(msg.id + "가 팀 " + teamNum + "으로 등록");
                    addUser(2, user);
                }
            }

            // 선택된 사용자의 채팅 입력 처리
            if (picked.id !== "" && msg.id === picked.id) {
                if (!isNegoMode && (msg.msg.startsWith("!pick ") || msg.msg.startsWith("!픽 "))) {
                    const team1 = await getTeamInfo(1);
                    const team2 = await getTeamInfo(2);
                    let nextPick = (team1 ? team1.cpick : 0) + (team2 ? team2.cpick : 0);

                    const pickSplited = msg.msg.split(" ");
                    let pickMsg = "";
                    for (let i = 1; i < pickSplited.length; i++) {
                        pickMsg += pickSplited[i];
                        if (i !== pickSplited.length - 1) pickMsg += " ";
                    }
                    msg.msg = pickMsg;
                    nextPick++;

                    user.picked = true;

                    if (await hasUser(1, user.id)) {
                        console.log("// team 1에 있음");
                        setTeamInfo(1, { ...team1, pickList: [...team1.pickList, msg] });
                    } else if (await hasUser(2, user.id)) {
                        console.log("// team 2에 있음");
                        setTeamInfo(2, { ...team2, pickList: [...team2.pickList, msg] });
                    } else {
                        console.log("// 아무 팀에도 없음");
                    }

                    speech(pickMsg);

                    // 현재 픽 수와 밴 간격을 계산하여 다음 페이즈를 결정
                    let nextPhase = 1;

                    if (nextPick >= turnPick * 2) {
                        nextPhase = 2;
                        nextPick = 0;

                        // 각 팀의 현재 pick도 초기화
                        // resetPick();
                    }

                    setDlgUser(false);
                    // setCurrentUser(new User("", "", false));
                    // setCurrentChat(new Array<Message>());
                    // setPhase(nextPhase);
                    // setTotalPick(totalPick + 1);

                    // state 변경 이후 실행되어야 함
                    // scrollToBottomPick(currentTeam);
                } else {
                    console.log("// display");
                    setChatList([...chatList, msg]);
                    speech(msg.msg);
                }
            }

            // 사용자 업데이트
            updateUser(user);
        }
    };
    // 해당 메시지를 Pick으로 선택하기
    // const useMessage = (msg: Message) => {
    //     let nextPick = getNextPick();

    //     let currentTeam = 0;

    //     if (hasMember(1, msg.id)) {
    //         currentTeam = 1;

    //         // 팀에 소속되어있다면 해당 팀의 픽 리스트에 등록
    //         addPick(1, msg);

    //         // 픽 한 유저는 리스트에서 더 사용할 수 없도록 처리함
    //         getMember(1, msg.id).picked = true;
    //         nextPick++;
    //     }
    //     if (hasMember(2, msg.id)) {
    //         currentTeam = 2;
    //         addPick(2, msg);
    //         getMember(2, msg.id).picked = true;
    //         nextPick++;
    //     }

    //     console.log(msg.id + "(팀" + currentTeam + ") MSG: " + msg.msg);
    //     speech(msg.msg);

    //     // 현재 픽 수와 밴 간격을 계산하여 다음 페이즈를 결정
    //     // phaseChange();
    //     // setTotalPick(totalPick + 1);
    //     // setUserDlg(false);
    //     // setCurrentUser(new User("", "", false));
    //     // setCurrentChat([]);

    //     // 끝나고 실행해야 할 것
    //     // scrollToBottomPick(currentTeam);
    // };

    return { registerObserver };
};

export default useIRC;
