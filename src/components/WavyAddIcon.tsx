import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface WavyAddIconProps {
    size?: number;
    color?: string;
}

export const WavyAddIcon: React.FC<WavyAddIconProps> = ({
    size = 64,
    color = '#3b82f6'
}) => {
    return (
        <Svg
            width={size}
            height={size}
            viewBox="0 0 100 100"
            fill="none"
        >
            {/* Vertical wavy line (plus sign) with smooth waves */}
            <Path
                d="M50 20 C48 28, 47 36, 49 42 C51 48, 50 50, 50 50 C50 50, 49 52, 51 58 C53 64, 52 72, 50 80"
                stroke={color}
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
            />

            {/* Horizontal wavy line (plus sign) with smooth waves */}
            <Path
                d="M20 50 C28 48, 36 47, 42 49 C48 51, 50 50, 50 50 C50 50, 52 49, 58 51 C64 53, 72 52, 80 50"
                stroke={color}
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
            />
        </Svg>
    );
};

export default WavyAddIcon;