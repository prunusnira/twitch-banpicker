import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { BPButton } from "../../../commonStyle/global.style";
import { Phase } from "../../../data/phase";
import { changePhase } from "../../../redux/banpickSlice";
import { RootState } from "../../../redux/reducer";
import { IBanpickData } from "../../main/useBanpickData";
import { PhaseWrapper, Row } from "./phase.style";

type Props = {
    banpickData: IBanpickData;
};

const PhaseIndicator = ({ banpickData }: Props) => {
    const { phase } = banpickData;
    const dispatch = useDispatch();

    return (
        <PhaseWrapper>
            {(function () {
                if (phase === Phase.READY) {
                    return <Row>GET READY</Row>;
                } else {
                    return (
                        <Row>
                            {phase === Phase.PICK ? "PICK" : "BAN"} PHASE
                            <BPButton
                                color="dark"
                                onClick={() =>
                                    dispatch({
                                        type: changePhase,
                                        payload: phase === Phase.PICK ? Phase.BAN : Phase.PICK,
                                    })
                                }
                            >
                                강제 페이즈 변경
                            </BPButton>
                        </Row>
                    );
                }
            })()}
        </PhaseWrapper>
    );
};

export default PhaseIndicator;
