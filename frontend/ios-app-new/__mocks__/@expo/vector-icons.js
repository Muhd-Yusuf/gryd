const React = require('react');
const { Text } = require('react-native');

const MockIcon = (props) => React.createElement(Text, props, props.name);

module.exports = {
    MaterialIcons: MockIcon,
    MaterialCommunityIcons: MockIcon,
};
